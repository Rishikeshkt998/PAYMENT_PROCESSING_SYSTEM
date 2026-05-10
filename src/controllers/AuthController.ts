import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

/**
 * Handles authentication requests.
 * Mirrors the brocamp-tool-v2 user access pattern.
 */
export default class AuthController {
  private secret = process.env.JWT_SECRET || 'fallback-secret'; 

  /**
   * Simple method to generate a JWT token for testing.
   */
  async generateToken(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body;

    // Dummy validation for demonstration
    if (email === 'admin@example.com' && password === 'admin123') {
      const token = jwt.sign(
        { id: 'admin_user_1', email, role: 'ADMIN' },
        this.secret,
        { expiresIn: '1h' }
      );

      res.status(200).json({
        status: 'success',
        message: 'Authentication successful',
        token,
      });
    } else {
      res.status(401).json({
        status: 'error',
        message: 'Invalid credentials. Use admin@example.com / admin123',
      });
    }
  }
}
