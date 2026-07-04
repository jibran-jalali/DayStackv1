import { NextResponse } from "next/server";

import { activateAdminAccount, deleteAdminAccount, disableAdminAccount } from "@/lib/admin/data";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { getErrorMessage } from "@/lib/utils";

function unauthorizedResponse() {
  return NextResponse.json(
    {
      message: "Admin authentication required.",
    },
    { status: 401 },
  );
}

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      accountId: string;
    }>;
  },
) {
  if (!(await isAdminAuthenticated())) {
    return unauthorizedResponse();
  }

  const { accountId } = await context.params;

  if (!isValidUuid(accountId)) {
    return NextResponse.json(
      {
        message: "Invalid account id.",
      },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | {
        action?: string;
      }
    | null;

  if (body?.action !== "activate" && body?.action !== "disable") {
    return NextResponse.json(
      {
        message: "Unsupported admin action.",
      },
      { status: 400 },
    );
  }

  try {
    const account =
      body.action === "disable"
        ? await disableAdminAccount(accountId)
        : await activateAdminAccount(accountId);

    return NextResponse.json({
      account,
      ok: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: {
    params: Promise<{
      accountId: string;
    }>;
  },
) {
  if (!(await isAdminAuthenticated())) {
    return unauthorizedResponse();
  }

  const { accountId } = await context.params;

  if (!isValidUuid(accountId)) {
    return NextResponse.json(
      {
        message: "Invalid account id.",
      },
      { status: 400 },
    );
  }

  try {
    await deleteAdminAccount(accountId);

    return NextResponse.json({
      id: accountId,
      ok: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}
