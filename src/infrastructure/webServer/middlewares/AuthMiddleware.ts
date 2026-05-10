import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

declare module 'express' {
  interface Request {
    user?: any;
  }
}

/**
 * Authentication middleware to protect routes.
 * Mirrors the brocamp-tool-v2 structure.
 */
export class AuthMiddleware {
  private static SECRET = process.env.JWT_SECRET || 'fallback-secret';

  static verifyToken(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        status: 'error',
        message: 'Unauthorized: No token provided',
      });
      return;
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, AuthMiddleware.SECRET);
      req.user = decoded;
      next();
    } catch (error) {
      res.status(401).json({
        status: 'error',
        message: 'Unauthorized: Invalid or expired token',
      });
    }
  }
}
