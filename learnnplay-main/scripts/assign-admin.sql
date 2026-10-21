-- Manual SQL script to assign admin role to redmi.v1990@gmail.com
-- Run this in Supabase SQL Editor after the user signs up

-- Step 1: Get the user ID
SELECT id, email FROM auth.users WHERE email = 'redmi.v1990@gmail.com';

-- Step 2: Copy the user_id from above and run:
INSERT INTO user_roles (user_id, role) 
VALUES ('PASTE_USER_ID_HERE', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Verify:
SELECT * FROM user_roles WHERE role = 'admin';
