import type { HttpException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

import { badRequest } from './api-error';

/**
 * Turns class-validator's errors into the one v2 error shape.
 *
 * Without this the global `ValidationPipe` throws Nest's own
 * `BadRequestException`, whose body carries `error: "Bad Request"` — so a
 * malformed payload came back as `error.code: "BAD_REQUEST"` while
 * the API contract promises **`VALIDATION_FAILED`**. The app's
 * screens branch on that value to say what went wrong, and a second name for
 * the same condition is a branch nobody wrote.
 *
 * `details` keeps class-validator's own sentences, path included
 * (`raw_data.crops.0.area must be …`), because the app shows `details[0]` to
 * the partner and "which one of the rows" is the useful half.
 */
export function validationExceptionFactory(
  errors: ValidationError[],
): HttpException {
  return badRequest(
    'VALIDATION_FAILED',
    'Request validation failed.',
    flatten(errors),
  );
}

function flatten(errors: ValidationError[], parentPath = ''): string[] {
  return errors.flatMap((error) => {
    const path = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;

    return [
      ...Object.values(error.constraints ?? {}).map((message) =>
        // class-validator names the leaf property only, so a nested failure
        // reads `area must be …` with no way to tell which row it was.
        message.startsWith(error.property)
          ? `${path}${message.slice(error.property.length)}`
          : message,
      ),
      ...flatten(error.children ?? [], path),
    ];
  });
}
