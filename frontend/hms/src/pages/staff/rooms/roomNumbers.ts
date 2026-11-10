/** Turn "101-110, 201 205, G1" into a list of room numbers. Ranges need two plain numbers. */
export const MAX_ROOMS_AT_ONCE = 200;

export function parseRoomNumbers(text: string): { numbers: string[]; error?: string } {
  const numbers: string[] = [];
  for (const part of text.split(/[\s,;]+/).filter(Boolean)) {
    const range = part.match(/^(\d+)-(\d+)$/);
    if (range) {
      const lo = Number(range[1]);
      const hi = Number(range[2]);
      if (hi < lo) return { numbers: [], error: `"${part}" goes backwards. Write it as ${range[2]}-${range[1]}.` };
      if (hi - lo + 1 > MAX_ROOMS_AT_ONCE) return { numbers: [], error: `A range can add at most ${MAX_ROOMS_AT_ONCE} rooms at a time.` };
      for (let n = lo; n <= hi; n++) numbers.push(String(n));
    } else if (/^[A-Za-z0-9]{1,20}$/.test(part)) {
      numbers.push(part.toUpperCase());
    } else {
      return { numbers: [], error: `"${part}" is not a room number. Use letters and digits only, or a range like 101-110.` };
    }
  }
  const unique = [...new Set(numbers)];
  if (unique.length > MAX_ROOMS_AT_ONCE) return { numbers: [], error: `Add at most ${MAX_ROOMS_AT_ONCE} rooms at a time.` };
  return { numbers: unique };
}

/** "101, 102, 103 … 110" for a short preview. */
export const previewNumbers = (n: string[]) => (n.length <= 6 ? n.join(', ') : `${n.slice(0, 3).join(', ')} … ${n.slice(-2).join(', ')}`);
