import urllib.request, urllib.error, json, sys

base = "http://localhost:8000/api/v1"

def test(name, req):
    try:
        resp = urllib.request.urlopen(req)
        return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"FAIL [{name}]: HTTP {e.code} - {e.read().decode()[:200]}")
        sys.exit(1)

# Register
data = json.dumps({"username": "railfan2", "email": "railfan2@test.in", "password": "securepass123", "display_name": "Rail Fan Two"}).encode()
tokens = test("register", urllib.request.Request(base + "/auth/register", data=data, headers={"Content-Type": "application/json"}, method="POST"))
print("REGISTER OK")

# /me
me = test("me", urllib.request.Request(base + "/auth/me", headers={"Authorization": "Bearer " + tokens["access_token"]}))
print(f"ME OK - username:{me['username']} karma:{me['karma']} trains_spotted:{me['trains_spotted']}")

# Login
login_data = json.dumps({"email": "railfan2@test.in", "password": "securepass123"}).encode()
t2 = test("login", urllib.request.Request(base + "/auth/login", data=login_data, headers={"Content-Type": "application/json"}, method="POST"))
print("LOGIN OK")

# Refresh
ref_data = json.dumps({"refresh_token": t2["refresh_token"]}).encode()
t3 = test("refresh", urllib.request.Request(base + "/auth/refresh", data=ref_data, headers={"Content-Type": "application/json"}, method="POST"))
print("REFRESH OK - new token:", t3["access_token"][:20] + "...")

# Wrong password
bad = json.dumps({"email": "railfan2@test.in", "password": "wrongpass"}).encode()
try:
    urllib.request.urlopen(urllib.request.Request(base + "/auth/login", data=bad, headers={"Content-Type": "application/json"}, method="POST"))
    print("FAIL - wrong password should be rejected")
    sys.exit(1)
except urllib.error.HTTPError as e:
    if e.code == 401:
        print("WRONG PASSWORD CORRECTLY REJECTED (401)")

print("\nAll Phase 1 auth tests PASSED")
