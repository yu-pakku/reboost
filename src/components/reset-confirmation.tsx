'use client';
import { useEffect, useRef } from 'react';
export function ResetConfirmation({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    const element = dialog.current;
    if (element && !element.open) {
      if (typeof element.showModal === 'function') element.showModal();
      else element.setAttribute('open', '');
    }
    cancel.current?.focus();
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={dialog} role="alertdialog" aria-modal="true" aria-labelledby="reset-title" aria-describedby="reset-description" className="reset-confirmation" onCancel={event => { event.preventDefault(); onCancel(); }}>
    <h2 id="reset-title">進捗をリセットして保存しますか？</h2><p id="reset-description">内容を変更するとLevel 1・成功0回・未定着に戻ります。過去の解答履歴は残ります。</p>
    <button type="button" className="secondary-button" ref={cancel} onClick={onCancel}>編集に戻る</button><button type="button" className="primary-button" onClick={onConfirm}>進捗リセットを確認して保存</button>
  </dialog>;
}
