# webanalytics
Bring your own web analytics

## Install
```
npm install
```

## Run
```
npm run dev
```

Log

Install auth

Create JWT secrets

```
uuidgen
coho set-env JWT_ACCESS_TOKEN_SECRET 'xxx' --encrypted
uuidgen
coho set-env JWT_REFRESH_TOKEN_SECRET 'xxx' --encrypted
```

Create a new user

First create a new API key

```
coho add-token
Created new token XXXX with access READWRITE
```

Create a user collection

```
coho createcollection users
```

Create a new user

```
curl --location 'https://youthful-watershed-23b6.codehooks.io/auth/createuser' \
--header 'x-apikey: XXXX' \
--header 'Content-Type: application/json' \
--data-raw '{
    "username": "me@example.com", 
    "password": "VerySecurePassword.with-123-numbers"      
}'
```

Install the client side analytics script

```
<script src="/analytics-script.js"></script>
```



