import requests

def test_live(tenant):
    payload = {"email": "amadariaga@modelo.edu.mx", "password": "Prueba123", "tenant": tenant}
    print(f"Testing login with tenant='{tenant}'...")
    r = requests.post("https://materialidad.online/api/accounts/token/", json=payload)
    if r.status_code == 200:
        data = r.json()
        print(f"Login success! Returned tenant: {data.get('tenant')}")
    else:
        print(f"Login failed: {r.status_code} - {r.text}")

test_live("casaclub")
test_live("escuelamodelo")
