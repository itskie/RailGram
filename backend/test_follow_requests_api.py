import asyncio
import os
import httpx

async def test_api():
    # Login as itsiiie
    async with httpx.AsyncClient() as client:
        # Login
        resp = await client.post('http://localhost:8000/api/v1/auth/login', json={
            'email': 'mdpkdy@gmail.com',
            'password': 'test1234'
        })
        if resp.status_code == 200:
            token = resp.json()['access_token']
            print(f'✅ Logged in as itsiiie')
            
            # Get follow requests
            resp = await client.get('http://localhost:8000/api/v1/users/requests',
                headers={'Authorization': f'Bearer {token}'}
            )
            print(f'Status: {resp.status_code}')
            print(f'Response: {resp.json()}')
        else:
            print(f'❌ Login failed: {resp.status_code}')

asyncio.run(test_api())
