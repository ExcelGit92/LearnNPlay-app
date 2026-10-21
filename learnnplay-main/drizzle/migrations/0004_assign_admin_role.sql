-- Assign admin role to redmi.v1990@gmail.com
-- This will be executed after the user signs up
-- To run manually after signup:
-- 1. Get user ID: SELECT id FROM auth.users WHERE email = 'redmi.v1990@gmail.com';
-- 2. Insert role: INSERT INTO user_roles (user_id, role) VALUES ('USER_ID_HERE', 'admin');

-- For automatic assignment, use the server function assignAdminRole after signup
