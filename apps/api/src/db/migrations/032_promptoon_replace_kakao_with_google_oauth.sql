DELETE FROM promptoon_oauth_account
WHERE provider = 'kakao';

DELETE FROM users
WHERE login_id LIKE 'kakao:%';
