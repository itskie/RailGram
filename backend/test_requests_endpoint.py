import asyncio
import os
import httpx

async def test():
    async with httpx.AsyncClient() as client:
        # Login as itskie
        resp = await client.post('http://localhost:8000/api/v1/auth/login', json={
            'email': 'itskie7910@gmail.com',
            'password': 'test1234'
        })
        if resp.status_code != 200:
            print(f'❌ Login failed: {resp.status_code}')
            print(resp.text)
            return
        
        token = resp.json()['access_token']
        print(f'✅ Logged in as itskie')
        
        # Get follow requests
        resp = await client.get('http://localhost:8000/api/v1/users/requests',
            headers={'Authorization': f'Bearer {token}'}
        )
        print(f'Status: {resp.status_code}')
        print(f'Response: {resp.json()}')

asyncio.run(test())
