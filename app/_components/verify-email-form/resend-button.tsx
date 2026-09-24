interface Props {
  secondsLeft: number;
  pending: boolean;
  onResend: () => void;
}

export function ResendButton({ secondsLeft, pending, onResend }: Props) {
  return (
    <button
      type="button"
      onClick={onResend}
      disabled={secondsLeft > 0 || pending}
      className="cursor-pointer text-sm text-muted-foreground underline-offset-2 hover:underline disabled:no-underline disabled:opacity-50 disabled:cursor-default"
    >
      {secondsLeft > 0 ? `Reenviar en ${secondsLeft}s` : "Reenviar código"}
    </button>
  );
}
