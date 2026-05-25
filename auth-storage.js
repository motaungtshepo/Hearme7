// Per-tab login (sessionStorage) so user + therapist can be open in separate tabs.
const AUTH_KEYS = ['token', 'userRole', 'userIdentifier', 'userId'];

const authStorage = {
    get(key) {
        return sessionStorage.getItem(key);
    },
    set(key, value) {
        sessionStorage.setItem(key, value);
    },
    setSession({ token, user }) {
        sessionStorage.setItem('token', token);
        sessionStorage.setItem('userRole', user.role);
        sessionStorage.setItem('userIdentifier', user.identifier);
        if (user.id) {
            sessionStorage.setItem('userId', user.id);
        }
    },
    clear() {
        AUTH_KEYS.forEach((key) => sessionStorage.removeItem(key));
    }
};
