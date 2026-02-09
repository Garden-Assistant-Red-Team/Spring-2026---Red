
package main.java;

import java.util.ArrayList;
import java.util.List;

public class Admin {
    private String username;
    private String password;
    private List<User> users;

    public Admin(String username, String password) {
        this.username = username;
        this.password = password;
        this.users = new ArrayList<>();
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public void addUser(User user) {
        users.add(user);
        System.out.println("User " + user.getUsername() + " added.");
    }

    public void removeUser(User user) {
        users.remove(user);
        System.out.println("User " + user.getUsername() + " removed.");
    }

}
