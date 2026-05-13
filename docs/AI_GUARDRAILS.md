# AI Guardrails

커밋/푸시 전:

1. git diff 확인
2. npm run lint / npx tsc --noEmit / npm run build 통과
3. hot mutation 5종은 mutationPath=rpc 유지
4. 일반 액션 후 /api/player/me 재조회 금지
5. AdFit은 PC side rail 전용, 모바일 ba.min.js 로드 금지
6. .env* 커밋 금지
7. push 전 변경 파일과 테스트 결과 먼저 보고
