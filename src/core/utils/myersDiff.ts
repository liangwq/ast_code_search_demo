// src/core/utils/myersDiff.ts

type Edit = {
  range: [number, number]; // [startOffset, endOffset]
  newText: string;
};

function myersDiff(oldText: string, newText: string): Edit[] {
  const oldLen = oldText.length;
  const newLen = newText.length;
  const max = oldLen + newLen;
  const v = new Array(2 * max + 1).fill(-1);
  const trace = new Array(max + 1).fill([]);

  for (let d = 0; d <= max; d++) {
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && v[k - 1] < v[k + 1])) {
        x = v[k + 1];
      } else {
        x = v[k - 1] + 1;
      }
      let y = x - k;
      const traceIndex = d + (k >= 0 ? k : -k);
      trace[traceIndex] = [...trace[traceIndex - 1]];
      while (x < oldLen && y < newLen && oldText[x] === newText[y]) {
        x++;
        y++;
        trace[traceIndex].push({ op: 'equal', char: oldText[x - 1] });
      }
      if (k === d || (k !== -d && v[k - 1] < v[k + 1])) {
        if (k > -d && k < d && trace[traceIndex - 2].length > trace[traceIndex - 1].length) {
          trace[traceIndex] = trace[traceIndex - 2];
        }
      }
      v[k] = x;
      if (x >= oldLen && y >= newLen) {
        const edits: Edit[] = [];
        let i = 0;
        let j = 0;
        for (const op of trace[traceIndex]) {
          if (op.op === 'equal') {
            i++;
            j++;
          } else if (op.op === 'insert') {
            edits.push({ range: [i, i], newText: op.char });
            j++;
          } else if (op.op === 'delete') {
            edits.push({ range: [i, i + 1], newText: '' });
            i++;
          }
        }
        return edits;
      }
    }
  }
  return [];
}

export function computeEdits(oldText: string, newText: string): Edit[] {
  return myersDiff(oldText, newText);
}
