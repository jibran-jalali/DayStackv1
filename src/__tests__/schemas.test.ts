import { describe, it, expect } from "vitest";
import { taskFormSchema, loginSchema, signupSchema } from "@/types/daystack";

describe("loginSchema", () => {
  it("rejects invalid email", () => {
    const result = loginSchema.safeParse({ email: "bad", password: "12345678" });
    expect(result.success).toBe(false);
  });

  it("rejects short password", () => {
    const result = loginSchema.safeParse({ email: "a@b.com", password: "short" });
    expect(result.success).toBe(false);
  });

  it("accepts valid input", () => {
    const result = loginSchema.safeParse({ email: "a@b.com", password: "12345678" });
    expect(result.success).toBe(true);
  });
});

describe("signupSchema", () => {
  it("accepts valid input with fullName", () => {
    const result = signupSchema.safeParse({
      email: "a@b.com",
      password: "12345678",
      fullName: "Test User",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid input without fullName", () => {
    const result = signupSchema.safeParse({
      email: "a@b.com",
      password: "12345678",
    });
    expect(result.success).toBe(true);
  });

  it("rejects password over 72 chars", () => {
    const result = signupSchema.safeParse({
      email: "a@b.com",
      password: "x".repeat(73),
    });
    expect(result.success).toBe(false);
  });
});

describe("taskFormSchema", () => {
  const validTask = {
    title: "Morning standup",
    taskDate: "2026-07-08",
    startTime: "09:00",
    endTime: "09:30",
    taskType: "generic",
  };

  it("accepts a valid one-time task", () => {
    const result = taskFormSchema.safeParse(validTask);
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = taskFormSchema.safeParse({ ...validTask, title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects end time before start time", () => {
    const result = taskFormSchema.safeParse({
      ...validTask,
      startTime: "10:00",
      endTime: "09:00",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid date format", () => {
    const result = taskFormSchema.safeParse({ ...validTask, taskDate: "07-08-2026" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid time format", () => {
    const result = taskFormSchema.safeParse({ ...validTask, startTime: "9am" });
    expect(result.success).toBe(false);
  });

  it("rejects meeting link for non-meeting task", () => {
    const result = taskFormSchema.safeParse({
      ...validTask,
      meetingLink: "https://meet.google.com/abc",
    });
    expect(result.success).toBe(false);
  });

  it("accepts meeting link for meeting task", () => {
    const result = taskFormSchema.safeParse({
      ...validTask,
      taskType: "meeting",
      meetingLink: "https://meet.google.com/abc",
    });
    expect(result.success).toBe(true);
  });

  it("rejects participants for non-meeting task", () => {
    const result = taskFormSchema.safeParse({
      ...validTask,
      participants: [{ id: "550e8400-e29b-41d4-a716-446655440000", fullName: "John" }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts participants for meeting task", () => {
    const result = taskFormSchema.safeParse({
      ...validTask,
      taskType: "meeting",
      participants: [{ id: "550e8400-e29b-41d4-a716-446655440000", fullName: "John" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects recurring block without weekdays", () => {
    const result = taskFormSchema.safeParse({
      ...validTask,
      blockMode: "recurring",
      weekdays: [],
    });
    expect(result.success).toBe(false);
  });

  it("accepts recurring block with valid weekdays", () => {
    const result = taskFormSchema.safeParse({
      ...validTask,
      blockMode: "recurring",
      weekdays: [3],
    });
    expect(result.success).toBe(true);
  });

  it("rejects duplicate weekdays", () => {
    const result = taskFormSchema.safeParse({
      ...validTask,
      blockMode: "recurring",
      weekdays: [3, 3],
    });
    expect(result.success).toBe(false);
  });

  it("defaults blockMode to one_time", () => {
    const result = taskFormSchema.safeParse(validTask);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.blockMode).toBe("one_time");
    }
  });

  it("rejects title over 120 chars", () => {
    const result = taskFormSchema.safeParse({
      ...validTask,
      title: "x".repeat(121),
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 8 participants", () => {
    const participants = Array.from({ length: 9 }, (_, i) => ({
      id: "550e8400-e29b-41d4-a716-446655440000",
      fullName: `User ${i}`,
    }));
    const result = taskFormSchema.safeParse({
      ...validTask,
      taskType: "meeting",
      participants,
    });
    expect(result.success).toBe(false);
  });
});
