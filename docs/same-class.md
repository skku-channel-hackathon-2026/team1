# 「같은 반」 — 구현 메모

시간표를 넣으면 같은 분반·같은 강의실에 앉는 새내기 중 공강까지 겹치는 사람을 찾아주는 채널톡 앱.
PRD의 P0 전부와 P1 중 매칭 요청/수락(F7), 노출 단계 제어(F9), 매칭 범위 선택(F11)을 구현했다.
F8(에타 캡처 파싱)은 유료 LLM API가 필요해 넣지 않기로 했고(팀 결정), F10(선후배)은 로드맵으로만 남긴다.

## 디자인

[awesome-design-md](https://github.com/VoltAgent/awesome-design-md/tree/main/design-md)의 **Airbnb** 시스템을
참고했다. 사람을 이어주는 소비자 서비스라는 점, 따뜻한 흰 캔버스에 포인트 색 하나만 쓰는 절제가 맞았다.

- 캔버스 `#ffffff`, 잉크 `#222222`, 헤어라인 `#dddddd`, 포인트(Rausch) `#ff385c` 하나만 CTA·1순위·같은 강의실 칸에 쓴다.
- 라운드는 8px(버튼·입력) / 14px(카드) / 9999px(배지·필터 pill). 그림자는 한 단계만(`--sc-shadow`).
- 타이포는 28/700 디스플레이, 20/600 타이틀, 16·14 본문. Airbnb Cereal 대신 Inter + 시스템 한글 폰트.
- Desk 다크 모드는 `.sc--dark`에서 같은 토큰을 어두운 값으로 다시 정의한다.
- 토큰과 컴포넌트는 `wam/src/pages/SameClass/sameClass.css`, `ui.tsx`에 있다. Bezier는 헤더(`WamHeader`)와 테마
  프로바이더만 남기고 화면 요소는 직접 그린다 — 참고 디자인을 그대로 살리기 위한 선택이다.
- **시간표는 에브리타임 스타일**이다(`TimetableGrid.tsx`). 시간 기반 행(9시부터), 요일 열, 과목별 색 블록에 과목명·교수·강의실.
  입력 화면에서는 빈 칸을 누르면 그 시간에 추가, 블록을 누르면 수정/삭제(`CourseEditor.tsx` 모달). 과목 리스트는 따로 두지 않는다.
- **점수는 100점 만점.** 내 시간표와 똑같은 사람이 100점이다(`selfScore`로 정규화). 카드에 `53점`, 상세 화면에
  네 항목(같은 강의실 / 같은 건물 / 공강 / 같은 방향 이동)을 막대로 보여준다. 총점은 네 항목 합의 반올림이라 항상 맞는다.
  순위는 정규화 전 원점수(`raw.score`)로 매긴다.
- **공강은 하나다.** 점심 시간대, 공동 공강, 수업 직후 공강을 UI에서 구분하지 않는다. 알고리즘 안에서는 체인·점심 가중치가
  그대로 살아 있고 전부 「공강」 항목으로 합산된다(팀 결정). 요약 문장도 「공강 N시간」으로만 쓴다.
- **같은 반이 된 뒤에도 겹치는 칸만 보인다.** 상대 단독 수업은 서버가 보내지 않는다. 수락의 결과는 상태 배지와 채팅방 알림이다.
- **채팅방 알림.** 요청과 성사 시 커맨드를 실행한 그룹 채팅에 앱 봇(`같은 반`)이 한 줄 남긴다. 전송 실패는 요청 처리에 영향을 주지
  않고 `notified: false`로만 돌아온다. 봇 전송에는 기존 튜토리얼과 같은 `writeGroupMessage` 권한을 쓴다.
- WAM 창은 `SIZES`에서 1400×1000을 요청한다. Desk는 뷰포트에 맞게 줄이므로 사실상 꽉 찬 창이 된다.
- 데모용 시간표 버튼은 「예시 시간표 불러오기」다. 사용자의 닉네임은 건드리지 않는다(`DEMO_PRESET`에 이름 없음).

## 실행 흐름

`/tutorial` 커맨드 → `tutorial.open` → WAM `tutorial`이 열린다. 커맨드 이름·Function 스키마는 바꾸지 않았다.
WAM은 하나이고 화면 전환은 내부 상태다.

| 화면            | 하는 일                                                                                                | 호출하는 Function                         |
| --------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| 로딩            | 프로필이 있으면 바로 추천으로, 없으면 입력으로                                                         | `tutorial.getProfile`, `tutorial.match`   |
| 1 시간표 입력   | 큰 에브리타임식 시간표에서 블록 클릭 수정·빈 칸 클릭 추가. 「예시 시간표」 프리셋. 초안은 localStorage | `tutorial.saveProfile` → `tutorial.match` |
| 2 추천 목록     | 정렬(추천/같은 수업/공강)·근접 등급·점심 요일·타 학과 토글. 모두 메모리에서 재계산                     | (없음)                                    |
| 3 겹쳐진 시간표 | 점수와 항목별 내역, 겹치는 칸만 0.4초에 걸쳐 점등, 요일별 한 줄 요약, 「같은 반 요청」                 | `tutorial.requestMatch`                   |

## Function

모두 `server/src/tutorial.functions.ts`. 호출자는 채널 매니저여야 하며 `ctx.caller.id`가 memberId다.

| 이름                     | 입력                     | 출력                                          |
| ------------------------ | ------------------------ | --------------------------------------------- |
| `tutorial.getProfile`    | `{}`                     | `{ profile: Profile \| null }`                |
| `tutorial.saveProfile`   | `ProfileInput`           | `{ profile }` (UPSERT)                        |
| `tutorial.deleteProfile` | `{}`                     | `{}` — 프로필과 관련 매칭 레코드 모두 삭제    |
| `tutorial.match`         | `{}`                     | `{ me, poolSize, results: MatchCandidate[] }` |
| `tutorial.requestMatch`  | `{ targetId, groupId? }` | `{ targetId, matchState, notified }`          |

`match`는 채널의 모든 프로필 + 시드 30명을 D1에서 읽어 메모리에서 O(N)으로 점수를 매긴다. 로컬 D1 기준 30ms 안팎.
정렬·필터는 WAM이 받은 목록 안에서 처리하므로 추가 호출이 없다.

## D1 키 (새 테이블 없음)

```
profile:<channelId>:<memberId>          → Profile JSON
match:<channelId>:<memberA>|<memberB>   → { pair, requestedBy[], acceptedAt?, updatedAt }
```

두 사람 모두 `requestedBy`에 있으면 ACCEPTED. 한쪽만 있으면 보낸 쪽은 REQUESTED, 받은 쪽은 RECEIVED.
시드 새내기(`seed:NN`)는 뒤에 사람이 없으므로 요청하면 즉시 수락한다(데모용, `same-class.store.ts`).

## 노출 단계

- 매칭 전후 모두: 닉네임, 점수, 근접 등급 배지, 이유 3줄, 겹치는 칸 위치(과목명은 내가 듣는 수업이라 표시).
- 상대 단독 수업·강의실 호수는 어느 단계에서도 서버가 보내지 않는다. 상호 수락은 배지와 채팅방 알림으로만 드러난다.

## 알고리즘 (`packages/shared/src/match.ts`)

- 슬롯 = 요일 × 1~10교시. 상태는 수업 인스턴스 / 공강(첫 수업과 마지막 수업 사이) / 없음.
- `prox` = 같은 인스턴스 `1.0 × idf` · 같은 건물 같은 층 `0.45` · 같은 건물 다른 층 `0.25` · 둘 다 공강 `0.15`.
- 보너스 = 체인(같은 수업 직후 둘 다 공강) `3.0` · 동행 이동 `1.0` · 점심 겹침 요일 `2.0`.
- `idf = log(1 + N / n_i)`. 분모 0을 피하기 위한 스무딩이며 다수가 듣는 분반은 낮게 평가된다.
- 건물 판정은 강의실 5자리 중 앞 2자리 + 캠퍼스로 키를 만든다(`31`은 인사캠 퇴계인문관, 자과캠 제1과학관).
- 하드 필터: 캠퍼스가 다르면 제외.
- 점심 = 11:30~13:30과 60분 이상 겹치는 교시(현재 3교시).

시드 30명 중 예시 시간표와 같은 학과 23명은 인스턴스 3개 이상 겹침 2명, 1~2개 8명, 0개 13명이다.
1순위 「하늘」은 53점, 수요일 `2교시 같이 듣고 → 공강 1시간 → 4교시 같이 듣고 → 공강 1시간 → 6교시 같이 듣고`가 나온다.

## 로컬에서 화면 보기 (Desk 없이)

```sh
corepack pnpm dev:wam    # http://localhost:5173
```

`vite` 개발 모드에서 실제 Desk 호스트(`window.ChannelIOWam`)가 없으면 `wam/src/local/mockHost.ts`가
대신 붙는다. 5개 Function을 브라우저 안에서 같은 `match.ts` 알고리즘과 localStorage 저장소로 처리하므로
입력 → 추천 → 겹쳐진 시간표 → 요청/수락 전 흐름이 그대로 돈다. 프로덕션 빌드에는 포함되지 않는다.

| 쿼리 파라미터      | 하는 일                                    |
| ------------------ | ------------------------------------------ |
| `?member=m2`       | 다른 매니저로 접속 (상호 수락 흐름 확인용) |
| `?appearance=dark` | 다크 테마                                  |
| `?reset=1`         | 저장된 프로필·매칭 초기화                  |

서버 로직·서명·D1까지 확인하려면 아래 Worker 실행과 `test:same-class`를 쓴다.

## 검증

```sh
corepack pnpm -r typecheck
corepack pnpm --filter @tutorial/server test        # 알고리즘·저장소 단위 테스트 포함
corepack pnpm --filter @tutorial/wam lint
corepack pnpm exec wrangler dev --local --port 8797 # 별도 터미널
corepack pnpm test:cloudflare && corepack pnpm test:same-class
```

`test:same-class`는 로컬 Worker에 서명된 요청으로 프로필 저장 → 시드 매칭(하늘 1순위) → 요청/수락 → 상호 수락 공개 →
캠퍼스 하드 필터 → 삭제까지 실제로 돌린다. CI의 Local Workers smoke 단계에 포함되어 있다.

## Desk에서 확인할 것

- WAM 창 크기는 `SameClassApp.tsx`의 `SIZES`(1400×1000)로 요청한다. Desk가 더 작게 잡으면 내부 스크롤로 동작한다.
- 실제 Desk 렌더링(Bezier 컴포넌트, 다크 테마, 애니메이션)은 배포 후 `앱_개발_검증` 그룹에서 확인해야 한다.
