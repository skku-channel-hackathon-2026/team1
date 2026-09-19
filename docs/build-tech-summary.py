"""Generate docs/같은반-기술개요.pdf — a short technical overview of the 「같은 반」 app.

Run: python docs/build-tech-summary.py
Korean text needs a real CJK font; Malgun Gothic ships with Windows.
"""

import os

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    HRFlowable,
    ListFlowable,
    ListItem,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

FONT_DIR = r"C:\Windows\Fonts"
pdfmetrics.registerFont(TTFont("Malgun", os.path.join(FONT_DIR, "malgun.ttf")))
pdfmetrics.registerFont(TTFont("MalgunBold", os.path.join(FONT_DIR, "malgunbd.ttf")))
pdfmetrics.registerFontFamily("Malgun", normal="Malgun", bold="MalgunBold")

INK = colors.HexColor("#222222")
MUTED = colors.HexColor("#6a6a6a")
RAUSCH = colors.HexColor("#ff385c")
HAIRLINE = colors.HexColor("#dddddd")
SOFT = colors.HexColor("#f7f7f7")

base = getSampleStyleSheet()
S = {
    "title": ParagraphStyle(
        "title", parent=base["Title"], fontName="MalgunBold", fontSize=24,
        leading=30, textColor=INK, alignment=TA_LEFT, spaceAfter=4,
    ),
    "subtitle": ParagraphStyle(
        "subtitle", parent=base["Normal"], fontName="Malgun", fontSize=11,
        leading=16, textColor=MUTED, spaceAfter=14,
    ),
    "h2": ParagraphStyle(
        "h2", parent=base["Heading2"], fontName="MalgunBold", fontSize=14,
        leading=19, textColor=INK, spaceBefore=14, spaceAfter=6,
    ),
    "h3": ParagraphStyle(
        "h3", parent=base["Heading3"], fontName="MalgunBold", fontSize=11,
        leading=15, textColor=INK, spaceBefore=8, spaceAfter=3,
    ),
    "body": ParagraphStyle(
        "body", parent=base["Normal"], fontName="Malgun", fontSize=9.5,
        leading=15, textColor=INK, spaceAfter=5,
    ),
    "small": ParagraphStyle(
        "small", parent=base["Normal"], fontName="Malgun", fontSize=8.5,
        leading=13, textColor=MUTED, spaceAfter=4,
    ),
    "cell": ParagraphStyle(
        "cell", parent=base["Normal"], fontName="Malgun", fontSize=8.5, leading=13,
        textColor=INK,
    ),
    "cellhead": ParagraphStyle(
        "cellhead", parent=base["Normal"], fontName="MalgunBold", fontSize=8.5,
        leading=13, textColor=INK,
    ),
    "code": ParagraphStyle(
        "code", parent=base["Normal"], fontName="Courier", fontSize=8.5,
        leading=13, textColor=INK, backColor=SOFT, borderPadding=6, spaceAfter=6,
    ),
}


def bullets(items):
    return ListFlowable(
        [ListItem(Paragraph(text, S["body"]), leftIndent=12) for text in items],
        bulletType="bullet", bulletColor=RAUSCH, bulletFontSize=7,
        leftIndent=12, spaceAfter=6,
    )


def table(rows, widths):
    data = [[Paragraph(c, S["cellhead"]) for c in rows[0]]] + [
        [Paragraph(c, S["cell"]) for c in row] for row in rows[1:]
    ]
    t = Table(data, colWidths=widths, hAlign="LEFT")
    t.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), SOFT),
            ("LINEBELOW", (0, 0), (-1, 0), 0.8, HAIRLINE),
            ("LINEBELOW", (0, 1), (-1, -2), 0.4, colors.HexColor("#ebebeb")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 7),
            ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ])
    )
    return t


def rule():
    return HRFlowable(width="100%", thickness=0.6, color=HAIRLINE,
                      spaceBefore=10, spaceAfter=2)


W = A4[0] - 40 * mm  # usable width
story = []

# ---------------------------------------------------------------- cover
story += [
    Paragraph("「같은 반」 기술 개요", S["title"]),
    Paragraph(
        "시간표를 넣으면 같은 분반·같은 강의실에 앉는 새내기를 찾아주는 채널톡 앱 "
        "&nbsp;·&nbsp; SKKU 2026 Team1",
        S["subtitle"],
    ),
    rule(),
    Paragraph("1. 무엇을 만들었나", S["h2"]),
    Paragraph(
        "대학에는 반이 없습니다. 과목마다 직권배정 분반이 달라 같은 얼굴을 반복해서 "
        "마주칠 구조가 사라졌기 때문입니다. 이 앱은 시간표를 받아 <b>같은 시간에 같은 "
        "공간에 있는 사람</b>을 찾아 점수로 보여줍니다. 친구를 소개하는 것이 아니라, "
        "이미 같은 공간에 있던 사람에게 이름을 붙여주는 서비스입니다.",
        S["body"],
    ),
    Paragraph(
        "핵심 아이디어는 매칭 단위를 <b>과목이 아니라 강의 인스턴스</b>로 잡은 것입니다. "
        "인스턴스는 (과목명, 교수, 요일·교시)의 조합이며, 이 셋이 같아야 실제로 같은 "
        "강의실에 같은 시간에 앉습니다. 과목만 같으면 서로 다른 분반일 수 있어 마주치지 "
        "않습니다. 1학년은 전공필수가 같아 과목 기준으로는 전원이 비슷해지지만, 인스턴스 "
        "기준이면 변별력이 생깁니다.",
        S["body"],
    ),
    Paragraph("2. 사용 흐름", S["h2"]),
    table(
        [
            ["화면", "하는 일"],
            ["오프닝", "아이콘·서비스명이 뜨는 동안 프로필과 추천을 불러옵니다."],
            ["시간표 입력",
             "에브리타임 스타일 주간 시간표. 빈 칸을 누르면 그 시간에 수업 추가, "
             "블록을 누르면 수정·삭제. 「예시 시간표 불러오기」로 데모 시간표를 한 번에 채웁니다."],
            ["추천 목록",
             "점수순 정렬, 1~3순위 하이라이트, 카드마다 이유 3줄과 미니 시간표. "
             "우상단 벨에 안 읽은 알림 개수."],
            ["겹쳐진 시간표",
             "내 시간표 위에 겹치는 칸만 0.4초에 걸쳐 점등. 점수 항목별 내역, "
             "요일별 한 줄 요약, 「같은 반 요청」, 상호 수락 시 1:1 채팅."],
        ],
        [28 * mm, W - 28 * mm],
    ),
    Paragraph("3. 점수 계산", S["h2"]),
    Paragraph(
        "두 사람의 시간표를 월~금 × 1~10교시 칸으로 펼치고, 같은 교시에 서로 얼마나 "
        "가까이 있는지를 칸마다 더합니다. 각 칸은 수업 / 공강 / 없음 중 하나입니다.",
        S["body"],
    ),
    table(
        [
            ["같은 교시에 두 사람이", "점수"],
            ["같은 수업 (과목·교수·요일·시작 교시가 같음)", "1.0"],
            ["같은 건물, 같은 층, 다른 강의실", "0.45"],
            ["같은 건물, 다른 층", "0.25"],
            ["둘 다 공강", "0.15"],
            ["그 외", "0"],
        ],
        [W - 30 * mm, 30 * mm],
    ),
    Spacer(1, 6),
    Paragraph(
        "공강은 그날 첫 수업과 마지막 수업 사이의 빈 교시에 더해, <b>첫 수업 직전 한 교시와 "
        "마지막 수업 직후 한 교시</b>를 포함합니다. 수업 앞뒤로 캠퍼스에 머무는 시간이 실제로 "
        "만날 수 있는 시간이기 때문입니다.",
        S["body"],
    ),
    Paragraph(
        "이렇게 구한 원점수를 <b>내 시간표를 그대로 가진 사람이 받을 점수</b>로 나눠 100을 "
        "곱합니다. 그래서 시간표가 완전히 같으면 100점이고, 화면에는 같은 강의실 / 같은 건물·"
        "다른 강의실 / 공강 세 항목으로 나뉘어 보입니다. 세 항목의 합이 총점입니다.",
        S["body"],
    ),
    Paragraph(
        "캠퍼스가 다르면 점수와 무관하게 제외합니다. 건물 판정은 강의실 번호 앞 두 자리로 하며, "
        "한 건물이 여러 코드를 갖는 경우(제1공학관 21·22·23)는 이름으로 묶습니다.",
        S["small"],
    ),
    Paragraph(
        "설계 과정에서 희소성 가중치(idf), 수업 직후 공강 보너스, 점심 보너스, 동행 이동 보너스를 "
        "차례로 넣었다가 모두 제거했습니다. 점수가 왜 그렇게 나왔는지 사용자가 한눈에 읽을 수 "
        "있는 것이 정교함보다 중요하다고 판단했습니다.",
        S["small"],
    ),
]

# ---------------------------------------------------------------- structure
story += [
    KeepTogether([Paragraph("4. 구조", S["h2"])]),
    Paragraph(
        "채널톡 앱 튜토리얼 템플릿 위에 얹었습니다. 서버는 Cloudflare Workers, DB는 팀 D1, "
        "화면은 Desk 안에서 열리는 React WAM입니다. 커맨드는 <font face='Courier'>/tutorial</font> "
        "이름을 그대로 유지했고, 새 마이그레이션도 추가하지 않았습니다. 둘 다 운영진의 등록 갱신이나 "
        "원격 DB 적용을 기다려야 해서 12시간 안에는 치명적인 대기가 되기 때문입니다.",
        S["body"],
    ),
    table(
        [
            ["계층", "선택", "메모"],
            ["실행", "Cloudflare Workers", "main 머지 → CI → 웹훅 자동 배포"],
            ["DB", "D1 <font face='Courier'>app_records</font>", "기존 (id, value_json) 테이블에 JSON으로 저장"],
            ["화면", "React WAM", "Desk 그룹 채팅 커맨드로 열림, 화면 전환은 내부 상태"],
            ["공유", "<font face='Courier'>packages/shared</font>", "타입·Zod 스키마·매칭 알고리즘을 서버와 화면이 공유"],
            ["검증", "Zod", "Function 입출력 스키마로 양쪽에서 검증"],
        ],
        [20 * mm, 42 * mm, W - 62 * mm],
    ),
    Paragraph("D1 저장 구조 (새 테이블 없음)", S["h3"]),
    Paragraph(
        "profile:&lt;channelId&gt;:&lt;memberId&gt;&nbsp;&nbsp;→ 프로필<br/>"
        "match:&lt;channelId&gt;:&lt;A&gt;|&lt;B&gt;&nbsp;&nbsp;→ 요청·수락 상태<br/>"
        "notif:&lt;channelId&gt;:&lt;memberId&gt;&nbsp;&nbsp;&nbsp;&nbsp;→ 알림 (최신순 50개)<br/>"
        "chat:&lt;channelId&gt;:&lt;A&gt;|&lt;B&gt;&nbsp;&nbsp;&nbsp;→ 대화 (오래된 순 200개)",
        S["code"],
    ),
    Paragraph("Function", S["h3"]),
    table(
        [
            ["이름", "역할"],
            ["getProfile / saveProfile / deleteProfile", "내 시간표 읽기·저장·삭제"],
            ["match", "채널 프로필 + 시드를 모두 읽어 메모리에서 점수 계산 후 정렬된 목록 반환"],
            ["requestMatch / cancelMatch", "같은 반 요청, 요청 취소·거절·해제"],
            ["inbox / readChat / sendChat", "앱 내 알림함과 1:1 채팅"],
        ],
        [52 * mm, W - 52 * mm],
    ),
    Paragraph(
        "추천은 한 채널에 N명이면 O(N) 완전 탐색이라 Function 한 번으로 끝납니다. 정렬과 필터는 "
        "이미 받은 목록을 화면에서 다시 계산하므로 추가 호출이 없습니다. 로컬 D1 기준 20~30ms입니다.",
        S["small"],
    ),
    KeepTogether([Paragraph("5. 프라이버시", S["h2"])]),
    Paragraph(
        "시간표는 내가 몇 시에 어디 있는지를 알려주는 위치 정보입니다. 그래서 "
        "<b>같은 반이 된 뒤에도 겹치는 칸만</b> 보여줍니다. 그 칸은 나도 같은 곳에 있는 시간이라 "
        "새로 드러나는 정보가 없습니다. 상대만 듣는 수업과 정확한 강의실 호수는 어느 단계에서도 "
        "서버 밖으로 나가지 않습니다. 수락의 결과는 상태 배지와 대화가 열리는 것뿐입니다.",
        S["body"],
    ),
    KeepTogether([Paragraph("6. 알림과 채팅", S["h2"])]),
    Paragraph(
        "처음에는 채널톡 DM으로 알리려 했지만 앱 권한 문제로 막혀, 앱 안에 알림함과 1:1 채팅을 "
        "직접 만들었습니다. 웹소켓이 없어 폴링으로 동작합니다. 알림은 6초, 열려 있는 대화는 5초 "
        "간격이며, 새 알림이 감지되면 매칭 상태도 함께 다시 읽어 상대가 수락한 순간 화면이 바뀝니다. "
        "채팅은 서로 수락한 사이에만 열리고, 취소하면 대화도 함께 삭제됩니다.",
        S["body"],
    ),
    KeepTogether([Paragraph("7. 데이터와 검증", S["h2"])]),
    bullets([
        "시드 새내기 29명을 코드로 생성합니다. 예시 시간표와 겹치는 과목 수가 5·4·3·2·1·0개 순으로 "
        "1·2·3·5·6·6명이라 점수가 89점부터 4점까지 고르게 퍼집니다.",
        "매칭 알고리즘은 순수 함수라 단위 테스트가 쉽습니다. 서버 테스트 24개가 분포, 점수 범위, "
        "공강 경계, 프라이버시 규칙(상대 단독 수업이 응답에 없는지)을 고정합니다.",
        "로컬 Cloudflare Worker에 서명된 요청을 보내는 스모크 테스트가 프로필 저장부터 추천, 요청·수락, "
        "알림, 채팅, 취소, 삭제까지 실제 D1에 대고 한 번에 돌립니다. CI에 포함되어 있습니다.",
        "Desk 없이도 개발할 수 있도록 개발 모드에서만 동작하는 로컬 목 호스트를 두었습니다. "
        "브라우저에서 같은 알고리즘으로 전 화면을 확인할 수 있고 프로덕션 번들에는 포함되지 않습니다.",
    ]),
    rule(),
    Paragraph(
        "규모: 공유 1,295줄 · 서버 1,606줄 · 화면 2,810줄 (TypeScript). "
        "디자인은 awesome-design-md의 Airbnb 시스템을 참고했고, 시간표는 에브리타임 형태를 따랐습니다.",
        S["small"],
    ),
]


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Malgun", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(20 * mm, 12 * mm, "「같은 반」 기술 개요 · SKKU 2026 Team1")
    canvas.drawRightString(A4[0] - 20 * mm, 12 * mm, f"{doc.page}")
    canvas.setStrokeColor(RAUSCH)
    canvas.setLineWidth(2)
    canvas.line(20 * mm, A4[1] - 14 * mm, 20 * mm + 28, A4[1] - 14 * mm)
    canvas.restoreState()


out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "같은반-기술개요.pdf")
doc = SimpleDocTemplate(
    out, pagesize=A4,
    leftMargin=20 * mm, rightMargin=20 * mm,
    topMargin=20 * mm, bottomMargin=20 * mm,
    title="「같은 반」 기술 개요", author="SKKU 2026 Team1",
)
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print("wrote", out)
