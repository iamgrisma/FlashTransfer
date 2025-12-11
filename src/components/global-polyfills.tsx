"use client";

import { useEffect } from 'react';
import * as process from 'process';
import { Buffer } from 'buffer';

export default function GlobalPolyfills() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.global = window;
      window.process = process;
      window.Buffer = Buffer;
    }
  }, []);

  return null;
}
