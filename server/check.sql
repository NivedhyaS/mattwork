SELECT email, role, "isActive", LEFT(password, 10) as hash_prefix FROM users ORDER BY role;
