import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { Request, Response, NextFunction } from 'express';

const extractValidationErrors = (errors: ValidationError[]): string[] => {
  return errors.reduce((acc: string[], err: ValidationError) => {
    if (err.constraints) {
      acc.push(...Object.values(err.constraints));
    }
    if (err.children && err.children.length > 0) {
      acc.push(...extractValidationErrors(err.children));
    }
    return acc;
  }, []);
};

export const validateDto = (dtoClass: any) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const dtoInstance = plainToInstance(dtoClass, req.body);
    const errors = await validate(dtoInstance);

    if (errors.length > 0) {
      const formattedErrors = extractValidationErrors(errors);
      
      return res.status(400).json({
        error: 'Bad Request',
        messages: formattedErrors
      });
    }

    req.body = dtoInstance;
    next();
  };
};