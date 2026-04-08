"""
Phase 6 – Chat Routes

REST (authenticated)
────────────────────
POST /conversations                             — start or retrieve a DM with a user
GET  /conversations                             — list caller's conversations (sorted by updated_at)
GET  /conversations/{conv_id}/messages          — cursor-paginated message history
POST /conversations/{conv_id}/messages          — send a message (also fans out via WS)
POST /conversations/{conv_id}/read              — mark conversation as read (clear unread_count)

WebSocket
─────────
WS   /ws/conversations/{conv_id}?token=<jwt>   — real-time channel

Incoming WS JSON: { "type": "message", "body": "...", "msg_type": "text" }
                  { "type": "read" }
                  { "type": "ping" }
Outgoing WS JSON: { "type": "message", "data": <MessageOut> }
                  { "type": "pong" }
                  { "type": "error", "data": {"detail": "..."} }
"""
import json
import uuid
from datetime import datetime
from typing import Annotated, Optional

from fastapi import (
    APIRouter, Depends, HTTPException, Query,
    Request, WebSocket, WebSocketDisconnect, status,
)
from sqlalchemy import desc, select, update as sqla_update
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import AsyncSessionLocal, get_db
from api.models.chat import Conversation, ConvParticipant, Message
from api.models.user import Block, User
from app.core.deps import get_current_user
from app.core.security import decode_token
from app.schemas.chat import (
    ConversationOut,
    MessageCreate,
    MessageOut,
    MessagesResponse,
    WSIncoming,
)
from app.services.chat_manager import chat_manager

router = APIRouter(tags=["chat"])


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_participant(
    db: AsyncSession, conv_id: uuid.UUID, user_id: uuid.UUID
) -> Optional[ConvParticipant]:
    res = await db.execute(
        select(ConvParticipant).where(
            ConvParticipant.conversation_id == conv_id,
            ConvParticipant.user_id == user_id,
        )
    )
    return res.scalar_one_or_none()


def _msg_to_out(m: Message) -> MessageOut:
    return MessageOut(
        id=m.id,
        conversation_id=m.conversation_id,
        sender_id=m.sender_id,
        msg_type=m.msg_type,
        body=None if m.is_deleted else m.body,
        media_key=None if m.is_deleted else m.media_key,
        train_no=m.train_no,
        station_code=m.station_code,
        is_deleted=m.is_deleted,
        read_at=m.read_at,
        created_at=m.created_at,
    )


async def _other_user(
    db: AsyncSession, conv: Conversation, me_id: uuid.UUID
) -> Optional[User]:
    """For a DM, return the other participant's User."""
    if conv.conv_type != "dm":
        return None
    for p in conv.participants:
        if p.user_id != me_id:
            res = await db.execute(select(User).where(User.id == p.user_id))
            return res.scalar_one_or_none()
    return None


async def _last_message(db: AsyncSession, conv_id: uuid.UUID) -> Optional[Message]:
    res = await db.execute(
        select(Message)
        .where(Message.conversation_id == conv_id, Message.is_deleted == False)  # noqa
        .order_by(desc(Message.created_at))
        .limit(1)
    )
    return res.scalar_one_or_none()


# ── Start / get DM conversation ───────────────────────────────────────────────

@router.post(
    "/conversations",
    response_model=ConversationOut,
    status_code=status.HTTP_201_CREATED,
)
async def start_conversation(
    target_username: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """
    Start (or retrieve existing) DM with target_username.
    Returns 404 if target user not found.
    Returns 403 if either party has blocked the other.
    """
    target_res = await db.execute(
        select(User).where(User.username == target_username, User.is_active == True)  # noqa
    )
    target = target_res.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot DM yourself")

    # Block check (either direction)
    block_res = await db.execute(
        select(Block).where(
            (Block.blocker_id == current_user.id) & (Block.blocked_id == target.id)
            | (Block.blocker_id == target.id) & (Block.blocked_id == current_user.id)
        )
    )
    if block_res.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Cannot message this user")

    # Check if DM already exists between the two users
    existing_res = await db.execute(
        select(Conversation)
        .join(ConvParticipant, ConvParticipant.conversation_id == Conversation.id)
        .where(
            Conversation.conv_type == "dm",
            ConvParticipant.user_id == current_user.id,
        )
    )
    for conv in existing_res.scalars().all():
        participants = [p.user_id for p in conv.participants]
        if target.id in participants:
            # Return existing
            my_p = next((p for p in conv.participants if p.user_id == current_user.id), None)
            lm = await _last_message(db, conv.id)
            return ConversationOut(
                id=conv.id,
                conv_type=conv.conv_type,
                other_user_id=target.id,
                other_username=target.username,
                other_display_name=target.display_name,
                other_avatar_url=target.avatar_url,
                other_last_seen_at=target.last_seen_at,
                last_message=lm.body if (lm and not lm.is_deleted) else None,
                last_message_at=lm.created_at if lm else None,
                unread_count=my_p.unread_count if my_p else 0,
                updated_at=conv.updated_at,
            )

    # Create new conversation
    conv = Conversation(conv_type="dm")
    db.add(conv)
    await db.flush()
    db.add(ConvParticipant(conversation_id=conv.id, user_id=current_user.id))
    db.add(ConvParticipant(conversation_id=conv.id, user_id=target.id))
    await db.commit()
    await db.refresh(conv, ["participants"])

    return ConversationOut(
        id=conv.id,
        conv_type="dm",
        other_user_id=target.id,
        other_username=target.username,
        other_display_name=target.display_name,
        other_avatar_url=target.avatar_url,
        other_last_seen_at=target.last_seen_at,
        last_message=None,
        last_message_at=None,
        unread_count=0,
        updated_at=conv.updated_at,
    )


# ── List conversations ────────────────────────────────────────────────────────

@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    limit: int = Query(30, ge=1, le=50),
):
    """Return the caller's conversations sorted by most-recently updated."""
    parts_res = await db.execute(
        select(ConvParticipant)
        .where(ConvParticipant.user_id == current_user.id)
        .limit(limit)
    )
    participants = parts_res.scalars().all()

    results: list[ConversationOut] = []
    for p in participants:
        conv_res = await db.execute(
            select(Conversation).where(Conversation.id == p.conversation_id)
        )
        conv = conv_res.scalar_one_or_none()
        if not conv:
            continue
        await db.refresh(conv, ["participants"])

        other = await _other_user(db, conv, current_user.id)
        lm = await _last_message(db, conv.id)
        results.append(ConversationOut(
            id=conv.id,
            conv_type=conv.conv_type,
            other_user_id=other.id if other else None,
            other_username=other.username if other else None,
            other_display_name=other.display_name if other else None,
            other_avatar_url=other.avatar_url if other else None,
            other_last_seen_at=other.last_seen_at if other else None,
            last_message=lm.body if (lm and not lm.is_deleted) else None,
            last_message_at=lm.created_at if lm else None,
            unread_count=p.unread_count,
            updated_at=conv.updated_at,
        ))

    results.sort(key=lambda x: x.updated_at, reverse=True)
    return results


# ── Get messages (cursor-paginated) ──────────────────────────────────────────

@router.get("/conversations/{conv_id}/messages", response_model=MessagesResponse)
async def get_messages(
    conv_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    before: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
):
    if not await _get_participant(db, conv_id, current_user.id):
        raise HTTPException(status_code=403, detail="Not a participant")

    q = select(Message).where(Message.conversation_id == conv_id)
    if before:
        try:
            cursor_dt = datetime.fromisoformat(before)
            q = q.where(Message.created_at < cursor_dt)
        except ValueError:
            pass
    q = q.order_by(desc(Message.created_at)).limit(limit)
    result = await db.execute(q)
    msgs = result.scalars().all()

    next_cursor = msgs[-1].created_at.isoformat() if len(msgs) == limit else None
    return MessagesResponse(
        messages=[_msg_to_out(m) for m in reversed(msgs)],
        next_cursor=next_cursor,
    )


# ── Send message (REST) ───────────────────────────────────────────────────────

@router.post(
    "/conversations/{conv_id}/messages",
    response_model=MessageOut,
    status_code=status.HTTP_201_CREATED,
)
async def send_message(
    conv_id: uuid.UUID,
    body: MessageCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    if not await _get_participant(db, conv_id, current_user.id):
        raise HTTPException(status_code=403, detail="Not a participant")

    if body.msg_type == "text" and not body.body:
        raise HTTPException(status_code=422, detail="body required for text messages")

    msg = Message(
        conversation_id=conv_id,
        sender_id=current_user.id,
        msg_type=body.msg_type,
        body=body.body,
        media_key=body.media_key,
        train_no=body.train_no,
        station_code=body.station_code,
    )
    db.add(msg)

    # Touch conversation updated_at + bump unread for others
    await db.execute(
        sqla_update(Conversation)
        .where(Conversation.id == conv_id)
        .values(updated_at=datetime.utcnow())
    )
    await db.execute(
        sqla_update(ConvParticipant)
        .where(
            ConvParticipant.conversation_id == conv_id,
            ConvParticipant.user_id != current_user.id,
        )
        .values(unread_count=ConvParticipant.unread_count + 1)
    )
    await db.commit()
    await db.refresh(msg)

    out = _msg_to_out(msg)
    # Fan out to all WS connections for this conversation
    await chat_manager.broadcast(str(conv_id), {"type": "message", "data": out.model_dump(mode="json")})
    return out


# ── Mark as read ─────────────────────────────────────────────────────────────

@router.post("/conversations/{conv_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(
    conv_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    await db.execute(
        sqla_update(ConvParticipant)
        .where(
            ConvParticipant.conversation_id == conv_id,
            ConvParticipant.user_id == current_user.id,
        )
        .values(unread_count=0, last_read_at=datetime.utcnow())
    )
    await db.commit()


# ── WebSocket endpoint ────────────────────────────────────────────────────────

@router.websocket("/ws/conversations/{conv_id}")
async def websocket_chat(
    websocket: WebSocket,
    conv_id: uuid.UUID,
):
    """
    Real-time chat channel.

    Authentication via access_token cookie (httpOnly, secure).
    Alternative: ?token=<access_jwt> query param for clients that can't use cookies.

    Message types the client can send:
      { "type": "message", "body": "...", "msg_type": "text" }
      { "type": "read" }
      { "type": "ping" }

    Server pushes:
      { "type": "message", "data": <MessageOut dict> }
      { "type": "pong" }
      { "type": "error", "data": {"detail": "..."} }
    """
    # Cookie-only auth — never accept token from query params (security risk: logged in URLs/proxies)
    token = websocket.cookies.get("access_token")

    if not token:
        await websocket.close(code=4001, reason="Authentication required")
        return
    
    # Authenticate
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        await websocket.close(code=4001, reason="Unauthorized")
        return

    user_id_str = payload.get("sub")
    try:
        user_id = uuid.UUID(user_id_str)
    except (TypeError, ValueError):
        await websocket.close(code=4001, reason="Invalid token")
        return

    # Verify participant
    async with AsyncSessionLocal() as db:
        p = await _get_participant(db, conv_id, user_id)
        if not p:
            await websocket.close(code=4003, reason="Not a participant")
            return

    # Update last_seen_at on connect
    async with AsyncSessionLocal() as db:
        await db.execute(
            sqla_update(User).where(User.id == user_id).values(last_seen_at=datetime.utcnow())
        )
        await db.commit()

    await chat_manager.connect(websocket, str(conv_id))

    # Notify other participant that this user is online
    await chat_manager.broadcast(str(conv_id), {
        "type": "presence",
        "user_id": str(user_id),
        "online": True,
    })

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
                incoming = WSIncoming.model_validate(data)
            except Exception:
                await websocket.send_text(json.dumps({"type": "error", "data": {"detail": "Invalid JSON"}}))
                continue

            if incoming.type == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))

            elif incoming.type == "typing":
                # Broadcast typing indicator to other participants (don't echo back)
                await chat_manager.broadcast_except(str(conv_id), websocket, {
                    "type": "typing",
                    "user_id": str(user_id),
                })

            elif incoming.type == "read":
                async with AsyncSessionLocal() as db:
                    await db.execute(
                        sqla_update(ConvParticipant)
                        .where(
                            ConvParticipant.conversation_id == conv_id,
                            ConvParticipant.user_id == user_id,
                        )
                        .values(unread_count=0, last_read_at=datetime.utcnow())
                    )
                    # Mark all messages in this conv (not mine) as read
                    await db.execute(
                        sqla_update(Message)
                        .where(
                            Message.conversation_id == conv_id,
                            Message.sender_id != user_id,
                            Message.read_at.is_(None),
                        )
                        .values(read_at=datetime.utcnow())
                    )
                    await db.commit()
                # Notify sender their messages were read
                await chat_manager.broadcast(str(conv_id), {
                    "type": "read",
                    "reader_id": str(user_id),
                    "conversation_id": str(conv_id),
                })

            elif incoming.type == "message":
                if incoming.msg_type == "text" and not incoming.body:
                    await websocket.send_text(json.dumps({"type": "error", "data": {"detail": "body required"}}))
                    continue

                try:
                    async with AsyncSessionLocal() as db:
                        msg = Message(
                            conversation_id=conv_id,
                            sender_id=user_id,
                            msg_type=incoming.msg_type or "text",
                            body=incoming.body,
                            media_key=incoming.media_key,
                            train_no=incoming.train_no,
                            station_code=incoming.station_code,
                        )
                        db.add(msg)
                        await db.execute(
                            sqla_update(Conversation)
                            .where(Conversation.id == conv_id)
                            .values(updated_at=datetime.utcnow())
                        )
                        await db.execute(
                            sqla_update(ConvParticipant)
                            .where(
                                ConvParticipant.conversation_id == conv_id,
                                ConvParticipant.user_id != user_id,
                            )
                            .values(unread_count=ConvParticipant.unread_count + 1)
                        )
                        await db.commit()
                        await db.refresh(msg)

                    out = _msg_to_out(msg)
                    await chat_manager.broadcast(
                        str(conv_id),
                        {"type": "message", "data": out.model_dump(mode="json")},
                    )
                except Exception as e:
                    await websocket.send_text(json.dumps({"type": "error", "data": {"detail": "Failed to send message"}}))

    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        chat_manager.disconnect(websocket, str(conv_id))
        # Update last_seen_at on disconnect
        async with AsyncSessionLocal() as db:
            await db.execute(
                sqla_update(User).where(User.id == user_id).values(last_seen_at=datetime.utcnow())
            )
            await db.commit()
        # Notify others this user went offline
        await chat_manager.broadcast(str(conv_id), {
            "type": "presence",
            "user_id": str(user_id),
            "online": False,
        })
