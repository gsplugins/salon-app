"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function CustomerPagePlaceholder(props: {
  title: string;
  description: string;
  bullets: string[];
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
      <h1 className="text-2xl font-semibold text-zinc-800 dark:text-white">{props.title}</h1>
      <p className="text-sm text-zinc-800 dark:text-zinc-400">{props.description}</p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
        {props.bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/customer/appointments">My appointments</Link>
        </Button>
        <Button asChild className="min-h-11">
          <Link href="/shops">Book now</Link>
        </Button>
      </div>
    </div>
  );
}

