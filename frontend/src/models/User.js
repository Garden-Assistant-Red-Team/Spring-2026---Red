// src/models/User.js

/**
 * User Model
 *
 * Attributes:
 * - id: unique user identifier
 * - username: display or login name
 * - email: user email address
 * - role: authorization level (user or admin)
 */


const USER_ROLES = {
  USER: "user",
  ADMIN: "admin",
};

class User {
    constructor(id = null, username = "", email = "", role = USER_ROLES.USER) {
        this.id = id;
        this.username = username;
        this.email = email;
        this.role = role;
    }
}

export { 
    User, 
    USER_ROLES 
};
