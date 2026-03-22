import requests

def test_login(email, password, tenant=None):
    payload = {"email": email, "password": password}
    if tenant:
        payload["tenant"] = tenant
    
    r = requests.post("https://materialidad.online/api/accounts/token/", json=payload)
    print(f"Login as {email} with tenant '{tenant}': Status: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        print(f"  Got tenant token for: {data.get('tenant')}")
    else:
        print(f"  Error: {r.json()}")

test_login("amadariaga@modelo.edu.mx", "Prueba123", "escuelamodelo")
test_login("amadariaga@modelo.edu.mx", "Prueba123", "casaclub")
