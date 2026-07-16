import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
import {
  Button,
  Spinner,
  Toast,
  ToastBody,
  ToastFooter,
  ToastTitle,
  Toaster,
  useId,
  useToastController,
} from "@fluentui/react-components";
import { match } from "ts-pattern";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { applyRetryDismissed, curvesApplied, selectApplyPhase } from "../store/curvesSlice";
import type { ApplyPhase } from "../store/curvesSlice";
import { toastDelivered } from "../store/toastsSlice";

/** Toast id of the single apply-progress toast, so it can be updated. */
const APPLY_TOAST_ID = "apply-progress";
/** How long an error toast stays up, in milliseconds. */
const ERROR_TIMEOUT_MS = 8000;
/** How long a success toast stays up, in milliseconds. */
const SUCCESS_TIMEOUT_MS = 4000;

/** The toast shown while the device is asked to confirm the new profile. */
function applyingToast(): ReactElement {
  return (
    <Toast>
      <ToastTitle media={<Spinner size="tiny" />}>Applying fan profile</ToastTitle>
      <ToastBody>Waiting for the cooler to confirm.</ToastBody>
    </Toast>
  );
}

/** The toast shown when the device never confirmed the applied profile. */
function unconfirmedToast(onRetry: () => void, onDismiss: () => void): ReactElement {
  return (
    <Toast>
      <ToastTitle>Profile not confirmed</ToastTitle>
      <ToastBody>The cooler has not reported the new profile back.</ToastBody>
      <ToastFooter>
        <Button size="small" appearance="primary" onClick={onRetry}>
          Retry
        </Button>
        <Button size="small" onClick={onDismiss}>
          Dismiss
        </Button>
      </ToastFooter>
    </Toast>
  );
}

/**
 * Bridges the store to Fluent's imperative toast API: drains the queued
 * error toasts, and keeps one persistent toast tracking the apply flow
 * (spinner while the device confirms, retry offer when it never does).
 *
 * @returns The mounted toaster outlet.
 */
export function AppToaster(): ReactElement {
  const toasterId = useId("app-toaster");
  const { dispatchToast, updateToast, dismissToast } = useToastController(toasterId);
  const dispatch = useAppDispatch();
  const queue = useAppSelector((state) => state.toasts.queue);
  const applyPhase = useAppSelector(selectApplyPhase);
  const edited = useAppSelector((state) => state.curves.edited);
  const previousPhase = useRef<ApplyPhase>("idle");

  useEffect(() => {
    for (const entry of queue) {
      dispatchToast(
        <Toast>
          <ToastTitle>{entry.title}</ToastTitle>
          <ToastBody>{entry.body}</ToastBody>
        </Toast>,
        {
          intent: entry.kind,
          timeout: entry.kind === "error" ? ERROR_TIMEOUT_MS : SUCCESS_TIMEOUT_MS,
        },
      );
      dispatch(toastDelivered(entry.key));
    }
  }, [queue, dispatch, dispatchToast]);

  useEffect(() => {
    const before = previousPhase.current;
    previousPhase.current = applyPhase;
    if (applyPhase === before) {
      return;
    }
    const retry = (): void => void dispatch(curvesApplied(edited));
    const dismiss = (): void => void dispatch(applyRetryDismissed());
    match(applyPhase)
      .with("idle", () => {
        dismissToast(APPLY_TOAST_ID);
      })
      .with("verifying", () => {
        const options = { toastId: APPLY_TOAST_ID, intent: "info", timeout: -1 } as const;
        if (before === "unconfirmed") {
          updateToast({ ...options, content: applyingToast() });
        } else {
          dispatchToast(applyingToast(), options);
        }
      })
      .with("unconfirmed", () => {
        updateToast({
          toastId: APPLY_TOAST_ID,
          content: unconfirmedToast(retry, dismiss),
          intent: "warning",
          timeout: -1,
        });
      })
      .exhaustive();
  }, [applyPhase, edited, dispatch, dispatchToast, updateToast, dismissToast]);

  return <Toaster toasterId={toasterId} position="bottom-end" pauseOnHover />;
}
