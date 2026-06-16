-- 웹(authenticated)에서도 계약/견적 번호 생성이 되도록 next_sequence 함수를 SECURITY DEFINER로.
-- 문제: 웹은 service_role이 아니라 로그인 사용자 권한이라, next_sequence 내부의
--       sequences 테이블 INSERT/UPDATE가 RLS에 막혀 계약번호 생성 실패(42501).
-- 해결: 함수를 정의자(소유자) 권한으로 실행 → RLS 우회. (함수 본문은 그대로)
-- Supabase SQL Editor에서 실행.

ALTER FUNCTION public.next_sequence(text) SECURITY DEFINER;

-- authenticated 역할에 실행 권한 보장
GRANT EXECUTE ON FUNCTION public.next_sequence(text) TO authenticated;
