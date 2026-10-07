import requests, time

t0 = time.time()
r_login = requests.post('http://127.0.0.1:8000/api/login', json={'username': 'admin', 'password': '@Admin123!'})
login_data = r_login.json()
token = login_data.get('access_token') or login_data.get('token')
print("Logged in, token present:", bool(token))

t1 = time.time()
r_pred = requests.post(
    'http://127.0.0.1:8000/api/predict',
    headers={'Authorization': f'Bearer {token}'},
    json={'items': [{'baseService': ['Basic Cleaning']}], 'priorityLevel': 'regular', 'grandTotal': 250}
)
print("Predict status:", r_pred.status_code, "in", round(time.time() - t1, 3), "s")
print("Prediction response:", r_pred.json())
