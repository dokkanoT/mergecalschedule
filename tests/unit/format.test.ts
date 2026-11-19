import { describe, expect, it } from "vitest";
import {
  dayHeaderLabel,
  formatDateTime,
  formatDateWithWeekday,
  formatLongDate,
  formatMonthDay,
  formatPeriod,
  formatWorkdays,
  weekdayLabel,
} from "@/lib/format";

describe("日付の表示", () => {
  it("11/19（木）の形", () => {
    expect(formatDateWithWeekday("2026-11-19")).toBe("11/19（木）");
    expect(formatLongDate("2026-11-19")).toBe("11月19日（木）");
  });

  it("年は基準日と年が違うときだけ付ける", () => {
    expect(formatMonthDay("2027-01-08")).toBe("1/8");
    expect(formatMonthDay("2027-01-08", "2026-11-19")).toBe("2027/1/8");
    expect(formatMonthDay("2026-12-03", "2026-11-19")).toBe("12/3");
  });

  it("期間：同じ年なら年なし、年をまたぐなら終わりに年", () => {
    expect(formatPeriod("2026-11-17", "2026-11-20")).toBe("11/17〜11/20");
    expect(formatPeriod("2026-12-28", "2027-01-08")).toBe("12/28〜2027/1/8");
  });

  it("日数は n稼働日", () => {
    expect(formatWorkdays(5)).toBe("5稼働日");
  });

  it("曜日の見出し：祝日は「祝」", () => {
    expect(weekdayLabel(5)).toBe("金");
    expect(dayHeaderLabel("2026-11-23")).toBe("祝"); // 勤労感謝の日
    expect(dayHeaderLabel("2026-11-24")).toBe("火");
    expect(() => weekdayLabel(8)).toThrow();
  });
});

describe("日時（困りごとの投稿時刻）", () => {
  it("東京の時刻で出す（UTC 15:30 は翌日 0:30）", () => {
    expect(formatDateTime(new Date("2026-11-19T05:05:00Z"))).toBe("11/19（木）14:05");
    expect(formatDateTime(new Date("2026-11-19T15:30:00Z"))).toBe("11/20（金）00:30");
  });
  it("年が違えば年を付ける", () => {
    expect(formatDateTime(new Date("2026-12-28T01:00:00Z"), "2027-01-04")).toBe("2026/12/28（月）10:00");
  });
});
