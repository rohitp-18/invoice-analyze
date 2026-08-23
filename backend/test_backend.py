import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.config import get_settings

client = TestClient(app)
settings = get_settings()

print("============================================================")
print("FASTAPI BACKEND COMPREHENSIVE DIAGNOSTIC TEST")
print("============================================================")

passed = 0
failed = 0

def assert_test(name, condition, extra=""):
    global passed, failed
    if condition:
        print(f"  [PASS] {name} {extra}")
        passed += 1
    else:
        print(f"  [FAIL] {name} {extra}")
        failed += 1

# 1. Root Endpoint Test
res = client.get("/")
assert_test("Root Endpoint GET /", res.status_code == 200, f"Status: {res.status_code}")

# 2. OpenAPI Documentation Test
res = client.get("/openapi.json")
assert_test("OpenAPI Schema GET /openapi.json", res.status_code == 200 and "paths" in res.json(), f"Status: {res.status_code}")

# 3. User Authentication Flow Test
test_email = "test_audit_bot@enterprise.com"
test_pwd = "StrongPassword123!"

# Register test
reg_res = client.post("/api/v1/auth/register", json={
    "name": "Audit Diagnostic Bot",
    "email": test_email,
    "password": test_pwd,
    "department": "Finance",
    "role": "ADMIN"
})
assert_test("Auth Register POST /api/v1/auth/register", reg_res.status_code in [200, 201, 400], f"Status: {reg_res.status_code}")

# Login test
login_res = client.post("/api/v1/auth/login", json={
    "email": test_email,
    "password": test_pwd
})
assert_test("Auth Login POST /api/v1/auth/login", login_res.status_code == 200 and "access_token" in login_res.json(), f"Status: {login_res.status_code}")

token = login_res.json().get("access_token") if login_res.status_code == 200 else None
headers = {"Authorization": f"Bearer {token}"} if token else {}

# 4. User Profile GET /api/v1/auth/me
me_res = client.get("/api/v1/auth/me", headers=headers)
assert_test("Auth Profile GET /api/v1/auth/me", me_res.status_code == 200 and me_res.json().get("email") == test_email, f"Status: {me_res.status_code}")

# 5. Dashboard Statistics GET /api/v1/dashboard/stats
dash_res = client.get("/api/v1/dashboard/stats", headers=headers)
assert_test("Dashboard Stats GET /api/v1/dashboard/stats", dash_res.status_code == 200 and "metrics" in dash_res.json(), f"Status: {dash_res.status_code}")

# 6. Spend Analysis Endpoints
sp_over_res = client.get("/api/v1/spend-analysis/overview", headers=headers)
assert_test("Spend Overview GET /api/v1/spend-analysis/overview", sp_over_res.status_code == 200 and "total_approved_spend" in sp_over_res.json(), f"Status: {sp_over_res.status_code}")

sp_ven_res = client.get("/api/v1/spend-analysis/vendors", headers=headers)
assert_test("Spend Vendors GET /api/v1/spend-analysis/vendors", sp_ven_res.status_code == 200 and "top_vendors" in sp_ven_res.json(), f"Status: {sp_ven_res.status_code}")

sp_all_res = client.get("/api/v1/spend-analysis/all", headers=headers)
assert_test("Spend Analysis All GET /api/v1/spend-analysis/all", sp_all_res.status_code == 200 and "overview" in sp_all_res.json() and "top_vendors" in sp_all_res.json(), f"Status: {sp_all_res.status_code}")

# 7. Compliance Policies GET /api/v1/policies
pol_res = client.get("/api/v1/policies", headers=headers)
assert_test("Compliance Policies GET /api/v1/policies", pol_res.status_code == 200, f"Status: {pol_res.status_code}")

# 8. All Invoices List GET /api/v1/invoice/get-all-invoice
inv_res = client.get("/api/v1/invoice/get-all-invoice", headers=headers)
assert_test("Invoice List GET /api/v1/invoice/get-all-invoice", inv_res.status_code == 200 and isinstance(inv_res.json(), list), f"Status: {inv_res.status_code}")

print("============================================================")
print(f"Diagnostic Summary: {passed} PASSED | {failed} FAILED")
print("============================================================")

if failed > 0:
    sys.exit(1)
