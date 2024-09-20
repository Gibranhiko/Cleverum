import { RegisterOptions } from 'react-hook-form';

export function passwordValidation(): RegisterOptions {
  return {
    required: "Password is required",
    minLength: {
      value: 6,
      message: "Password must be at least 6 characters long",
    },
    pattern: {
      value: /^(?=.*[A-Z])(?=.*\d)[A-Za-z\d.$_?¿¡!+-]{6,}$/,
      message: "Password must contain at least one uppercase letter, one number, and only allowed special characters (. $ _ ? ¿ ¡ ! + -)",
    }
  };
}
