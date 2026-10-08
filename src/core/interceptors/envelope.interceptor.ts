import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { map, type Observable } from 'rxjs';

export interface ApiEnvelope<T> {
  success: true;
  data: T;
}

/**
 * One response shape for the entire API — the same one prasar-backend and
 * franchise-offline-hub answer with, so the HO portal's shared HTTP client
 * reads every backend the same way:
 *
 *   { "success": true, "data": <payload> }
 *
 * Lists put their counters **inside** `data` (`PageResult`). Errors mirror the
 * shape via `AllExceptionsFilter`: `{ "success": false, "error": {...} }`.
 * A controller returns a plain value and never builds this itself.
 */
@Injectable()
export class EnvelopeInterceptor<T> implements NestInterceptor<
  T,
  ApiEnvelope<T>
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiEnvelope<T>> {
    return next
      .handle()
      .pipe(map((payload) => ({ success: true as const, data: payload })));
  }
}
