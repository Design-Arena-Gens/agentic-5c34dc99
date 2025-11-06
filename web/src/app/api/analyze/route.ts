import { NextRequest, NextResponse } from "next/server";

import {
  SocialbladeError,
  fetchInstagramMetrics,
  type InstagramMetrics,
} from "@/lib/socialblade";

type AnalyzeRequest = {
  handles?: unknown;
};

type AnalyzeResponse = {
  data: InstagramMetrics[];
  errors: Array<{ handle: string; message: string }>;
};

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as AnalyzeRequest;

  if (!Array.isArray(payload.handles) || payload.handles.length === 0) {
    return NextResponse.json(
      { message: "Provide at least one Instagram handle." },
      { status: 400 },
    );
  }

  const uniqueHandles = Array.from(
    new Set(
      payload.handles
        .map((value) => String(value ?? "").trim())
        .filter((value) => value.length > 0),
    ),
  );

  if (uniqueHandles.length === 0) {
    return NextResponse.json(
      { message: "Provide at least one valid Instagram handle." },
      { status: 400 },
    );
  }

  const results = await Promise.allSettled(
    uniqueHandles.map((handle) => fetchInstagramMetrics(handle)),
  );

  const response: AnalyzeResponse = {
    data: [],
    errors: [],
  };

  results.forEach((result, index) => {
    const originalHandle = uniqueHandles[index];

    if (result.status === "fulfilled") {
      response.data.push({
        ...result.value,
      });
    } else {
      const reason = result.reason as Error;
      if (reason instanceof SocialbladeError) {
        response.errors.push({
          handle: originalHandle,
          message: reason.message,
        });
      } else {
        response.errors.push({
          handle: originalHandle,
          message: reason.message || "An unexpected error occurred.",
        });
      }
    }
  });

  return NextResponse.json(response);
}
