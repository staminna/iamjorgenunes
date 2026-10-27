# Extensão .inc (não .conf) para o nginx.conf não o incluir ao nível http.
# Incluído em cada location porque add_header não é herdado quando a
# location define os seus próprios add_header.
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
