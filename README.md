# Developed by KidNextDoor

## t.me/kidnextdoor65

### Chức năng
**Claim points mỗi 24h**

### Hướng Dẫn Sử Dụng
1.  **Chuẩn bị dữ liệu tài khoản:**
    * Mở tệp `token.txt`.
    * Mỗi dòng 1 token F12 - Network - me - `eyj....` (có thể lấy nhanh bằng đoạn code dưới và dán vào console F12)
2.  **Chạy Script:**

        npm install
    
        node main.js

**For F12 console**

    (function() {
        // Store original functions to allow restoration and prevent multiple wrappings
        if (typeof window.originalFetch === 'undefined') {
            window.originalFetch = window.fetch;
        }
        if (typeof window.originalXHRSetRequestHeader === 'undefined') {
            window.originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
        }
    
        // Intercept fetch requests
        window.fetch = async function(...args) {
            const config = args[1]; // Configuration object is the second argument
    
            if (config && config.headers) {
                let authHeaderValue = null;
                // Headers can be a plain object or a Headers instance
                if (typeof config.headers.get === 'function') { // Headers instance
                    authHeaderValue = config.headers.get('Authorization');
                } else if (config.headers.Authorization) { // Plain object, standard casing
                    authHeaderValue = config.headers.Authorization;
                } else if (config.headers.authorization) { // Plain object, lowercase casing
                     authHeaderValue = config.headers.authorization;
                }
    
                if (authHeaderValue && typeof authHeaderValue === 'string' && authHeaderValue.toLowerCase().startsWith('bearer ')) {
                    const token = authHeaderValue.substring(7); // Length of "Bearer "
                    console.log(token);
                }
            }
            // Call the original fetch function and return its result
            return window.originalFetch.apply(this, args);
        };
    
        // Intercept XMLHttpRequest setRequestHeader
        XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
            if (header.toLowerCase() === 'authorization' && typeof value === 'string' && value.toLowerCase().startsWith('bearer ')) {
                const token = value.substring(7); // Length of "Bearer "
                console.log(token);
            }
            // Call original setRequestHeader
            return window.originalXHRSetRequestHeader.apply(this, arguments);
        };
    })();
