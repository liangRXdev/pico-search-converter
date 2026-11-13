// 有副作用的瀏覽器操作：剪貼簿與檔案下載。失敗時回傳 false，由呼叫端告知使用者。

/** 舊瀏覽器或非安全來源（http）沒有 Clipboard API 時的退路。 */
function copyWithExecCommand(text: string): boolean {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 權限被拒或文件未聚焦：改走退路。
  }
  return copyWithExecCommand(text);
}

/** 以 UTF-8（含 BOM，讓舊版 Windows 記事本正確判讀中文）下載純文字檔。 */
export function downloadText(filename: string, text: string): boolean {
  try {
    const blob = new Blob(['\uFEFF', text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}
