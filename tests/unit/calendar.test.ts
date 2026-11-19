import { describe, expect, it } from "vitest";
import {
  addDays,
  addWorkdays,
  diffDays,
  holidayName,
  isIsoDate,
  isoWeekday,
  isWorkday,
  nextWorkday,
  nonWorkdayReason,
  previousWorkday,
  todayInTokyo,
  weekEndDate,
  workdayOnOrAfter,
  workdayOnOrBefore,
  workdaysBetween,
} from "@/lib/calendar";

// 2026-11 のカレンダー：11/23(月) 勤労感謝の日、11/27(金)、11/28(土)、11/29(日)、11/30(月)

describe("isIsoDate", () => {
  it("実在する日付だけを受け付ける", () => {
    expect(isIsoDate("2026-11-18")).toBe(true);
    expect(isIsoDate("2026-02-29")).toBe(false); // 2026 はうるう年ではない
    expect(isIsoDate("2026-11-1")).toBe(false);
    expect(isIsoDate("2026/11/18")).toBe(false);
  });
});

describe("isWorkday（R0）", () => {
  it("平日は稼働日", () => {
    expect(isWorkday("2026-11-18")).toBe(true); // 水
    expect(isWorkday("2026-11-27")).toBe(true); // 金
  });

  it("土日は稼働日でない", () => {
    expect(isWorkday("2026-11-28")).toBe(false);
    expect(isWorkday("2026-11-29")).toBe(false);
  });

  it("祝日（2026-11-23 勤労感謝の日）は稼働日でない", () => {
    expect(holidayName("2026-11-23")).toBe("勤労感謝の日");
    expect(isWorkday("2026-11-23")).toBe(false);
  });

  it("元日・成人の日も稼働日でない（minebook・nomiメモの締切前後）", () => {
    expect(isWorkday("2027-01-01")).toBe(false);
    expect(isWorkday("2027-01-11")).toBe(false);
  });

  it("休みの理由を返す", () => {
    expect(nonWorkdayReason("2026-11-28")).toBe("土曜日");
    expect(nonWorkdayReason("2026-11-29")).toBe("日曜日");
    expect(nonWorkdayReason("2026-11-23")).toBe("勤労感謝の日");
    expect(nonWorkdayReason("2026-11-24")).toBeNull();
  });

  it("形式が正しくない日付はエラー", () => {
    expect(() => isWorkday("2026-13-01")).toThrow(RangeError);
  });
});

describe("addDays / diffDays / isoWeekday", () => {
  it("月またぎ・年またぎ", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(diffDays("2026-11-18", "2026-11-25")).toBe(7);
  });

  it("ISO 曜日（月=1 … 日=7）", () => {
    expect(isoWeekday("2026-11-23")).toBe(1);
    expect(isoWeekday("2026-11-27")).toBe(5);
    expect(isoWeekday("2026-11-29")).toBe(7);
  });
});

describe("nextWorkday / previousWorkday", () => {
  it("金曜の次は月曜", () => {
    expect(nextWorkday("2026-11-27")).toBe("2026-11-30");
  });

  it("祝日の月曜を飛ばす（11/20 金 → 11/24 火）", () => {
    expect(nextWorkday("2026-11-20")).toBe("2026-11-24");
  });

  it("火曜の前は、祝日の月曜を飛ばして金曜", () => {
    expect(previousWorkday("2026-11-24")).toBe("2026-11-20");
  });

  it("onOrAfter / onOrBefore は稼働日ならそのまま", () => {
    expect(workdayOnOrAfter("2026-11-24")).toBe("2026-11-24");
    expect(workdayOnOrAfter("2026-11-28")).toBe("2026-11-30");
    expect(workdayOnOrBefore("2026-11-29")).toBe("2026-11-27");
  });
});

describe("addWorkdays", () => {
  it("金曜 + 1 稼働日 = 翌月曜", () => {
    expect(addWorkdays("2026-11-27", 1)).toBe("2026-11-30");
  });

  it("金曜 + 1 稼働日（翌月曜が祝日）= 火曜", () => {
    expect(addWorkdays("2026-11-20", 1)).toBe("2026-11-24");
  });

  it("月をまたぐ（金曜 11/27 → 翌週・翌月）", () => {
    expect(addWorkdays("2026-11-27", 5)).toBe("2026-12-04");
  });

  it("0 ならそのまま、負なら前へ", () => {
    expect(addWorkdays("2026-11-18", 0)).toBe("2026-11-18");
    expect(addWorkdays("2026-11-30", -1)).toBe("2026-11-27");
    expect(addWorkdays("2026-11-24", -1)).toBe("2026-11-20");
  });

  it("休みの日から数えると、最初の稼働日が +1", () => {
    expect(addWorkdays("2026-11-28", 1)).toBe("2026-11-30");
  });

  it("年末年始（元日を飛ばす）", () => {
    expect(addWorkdays("2026-12-31", 1)).toBe("2027-01-04");
  });

  it("小数はエラー", () => {
    expect(() => addWorkdays("2026-11-18", 1.5)).toThrow(RangeError);
  });
});

describe("workdaysBetween（両端含む）", () => {
  it("同じ平日 1 日なら 1", () => {
    expect(workdaysBetween("2026-11-18", "2026-11-18")).toBe(1);
  });

  it("月〜金の 1 週間は 5", () => {
    expect(workdaysBetween("2026-11-30", "2026-12-04")).toBe(5);
  });

  it("土日を挟むと数えない（木〜火 = 4）", () => {
    expect(workdaysBetween("2026-11-26", "2026-12-01")).toBe(4);
  });

  it("祝日を挟むと数えない（11/20 金〜11/24 火 = 2）", () => {
    expect(workdaysBetween("2026-11-20", "2026-11-24")).toBe(2);
  });

  it("休みの日だけなら 0、逆順なら 0", () => {
    expect(workdaysBetween("2026-11-28", "2026-11-29")).toBe(0);
    expect(workdaysBetween("2026-11-24", "2026-11-20")).toBe(0);
  });
});

describe("weekEndDate（R5：週の最終日）", () => {
  it("既定は金曜", () => {
    expect(weekEndDate("2026-11-18")).toBe("2026-11-20");
    expect(weekEndDate("2026-11-23")).toBe("2026-11-27"); // 祝日の月曜から見ても同じ週
  });

  it("日曜から見ると、その週（月〜日）の金曜", () => {
    expect(weekEndDate("2026-11-29")).toBe("2026-11-27");
  });

  it("金曜が祝日なら直前の稼働日（2027-01-01 元日 → 2026-12-31）", () => {
    expect(weekEndDate("2026-12-30")).toBe("2026-12-31");
  });

  it("曜日を変えられる（水曜 = 3）", () => {
    expect(weekEndDate("2026-11-27", 3)).toBe("2026-11-25");
  });

  it("土日は指定できない", () => {
    expect(() => weekEndDate("2026-11-18", 6)).toThrow(RangeError);
  });
});

describe("todayInTokyo", () => {
  it("UTC で前日でも、東京の日付を返す", () => {
    // 2026-11-18 23:30 UTC = 2026-11-19 08:30 JST
    expect(todayInTokyo(new Date("2026-11-18T23:30:00Z"))).toBe("2026-11-19");
  });
});
