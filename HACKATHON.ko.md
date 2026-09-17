# 성균관대 해커톤 앱 스타터

공식 app-tutorial-ts 기반입니다. 팀별로 이 저장소를 복제하고 앱 ID와 비밀 키를 분리합니다.
SDK 0.17.2, pnpm 11.24.0, Node.js 24를 사용합니다. 행사 중 의존성 버전은 임의로 변경하지 않습니다.

## 로컬 개발

```sh
corepack pnpm install --frozen-lockfile
cp server/.env.example server/.env
corepack pnpm build
corepack pnpm dev:server
# 별도 터미널
corepack pnpm dev:wam
```

서버 Function은 `server/src/tutorial.functions.ts`, 화면은 `wam/src/pages/Send/Send.tsx`,
공유 입력·출력 타입은 `packages/shared/src/index.ts`에서 수정합니다.
서버 로컬 실행은 기본적으로 앱을 자동 등록합니다. 배포 URL이 등록된 앱을 로컬에서 실험할 때는
`AUTO_REGISTER=false`로 실행하고, 별도 개발 앱을 사용하세요.

## 운영진: Vercel 최초 설정

1. 팀 레포를 Vercel 프로젝트에 연결합니다. Root Directory는 저장소 루트, Framework는 Other,
   Node.js는 24.x, 운영 브랜치는 main입니다. `vercel.json`의 설치·빌드 명령을 사용합니다.
2. Production 환경변수에 해당 팀의 `APP_ID`, `APP_SECRET`, `SIGNING_KEY`를 설정합니다.
   비밀 키는 서버 환경에만 저장하고 Git, WAM, 이메일 본문에 넣지 않습니다.
   Preview에는 운영 자격 증명을 복사하지 않습니다. Preview 앱 검증은 별도 앱이 필요합니다.
3. 배포 후 고정 Production 도메인을 확인합니다. `/api/health`의 200 응답은 프로세스 확인일 뿐
   앱 등록·권한·Function 성공을 증명하지 않습니다.
4. 앱 개발자 설정에 Function Endpoint `https://HOST/functions`,
   WAM Endpoint `https://HOST/resource/wam`을 저장합니다. `/v1`, `/tutorial`을 덧붙이지 않습니다.
5. 해당 팀 자격 증명을 로컬 `server/.env`에 안전하게 설정한 뒤 `corepack pnpm register`를 실행합니다.
   이 명령은 실제 앱의 Extension 등록을 변경합니다. 배포된 URL이 먼저 응답해야 합니다.
   Vercel의 콜드 스타트에서는 자동 등록하지 않습니다.
6. 해당 팀 개발 채널에 앱을 설치합니다. `writeGroupMessage`, `writeGroupMessageAsManager`는
   튜토리얼 메시지 예제에 필요합니다. 팀의 기능에 맞춰 필요한 권한만 설정합니다.
7. 채널의 테스트 그룹에서 `/tutorial`을 실행해 WAM을 열고 두 전송 경로를 검증합니다.
   실제 메시지가 생성되므로 운영진이 지정한 테스트 그룹에서 실행합니다.
8. Vercel Deployment Protection이 Function 호출 또는 WAM 로드를 막지 않는지 확인합니다.
   Function의 서명 검증은 유지합니다. 다른 팀의 앱·프로젝트 접근 권한이 없는지도 확인합니다.

## 팀장 인계

GitHub 레포, Vercel 프로젝트, 앱 관리 화면, 개발 채널 URL과 초대 수락 여부를 전달합니다.
각 팀장이 작은 화면 변경을 push하고 실제 채널에서 확인해야 인계 완료입니다.
Function 스키마·Extension 메타데이터 변경 후에는 배포 완료 후 운영진과 등록 갱신을 진행합니다.
일반 로직/UI 변경은 재배포 후 확인합니다. 비밀 키를 문의 채널에 붙여 넣지 마세요.

## 검증과 장애 대응

```sh
corepack pnpm typecheck
corepack pnpm test
corepack pnpm lint
corepack pnpm build:vercel
corepack pnpm test:vercel
```

서버리스 산출물은 `.vercel/output`입니다. 로컬 smoke는 합성 자격 증명을 사용하며 외부 API 호출을
차단합니다. 실제 Vercel 라우팅·앱 설치·호스트 WAM 실행은 별도로 검증해야 합니다.
서버리스에서는 메모리와 로컬 파일을 영속 저장소로 사용하지 않습니다.
실패하면 Vercel 로그, 마지막 정상 배포, 앱 Endpoint·권한·서명 키를 순서대로 확인합니다.
지원 종료일과 비용 한도는 운영진 안내를 따릅니다.
