import requests

def test_me():
    # 1. Get token
    payload = {"email": "amadariaga@modelo.edu.mx", "password": "Prueba123", "tenant": "casaclub"}
    r = requests.post("https://materialidad.online/api/accounts/token/", json=payload)
    if r.status_code != 200:
        print(f"Token error: {r.json()}")
        return
    token = r.json()["access"]
    
    # 2. Get profile
    headers = {"Authorization": f"Bearer {token}", "X-Tenant": "casaclub"}
    r = requests.get("https://materialidad.online/api/accounts/me/", headers=headers)
    print(f"Profile tenant_slug = {r.json().get('tenant_slug')}")

test_me()
