/**
 * Client-side encryption service for protecting script content
 * Uses AES-GCM encryption with a user-derived key
 */

export interface EncryptedData {
  encryptedContent: string;
  iv: string;
  salt: string;
  version: string; // Add version for future compatibility
}

export class EncryptionService {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256;
  private static readonly IV_LENGTH = 12;
  private static readonly SALT_LENGTH = 16;
  private static readonly ITERATIONS = 100000;
  private static readonly VERSION = '1.0';

  /**
   * Encrypt script content
   */
  static async encryptContent(
    content: string, 
    userId: string, 
    masterPassword?: string
  ): Promise<EncryptedData> {
    try {
      console.log('🔒 Encrypting script content...', {
        contentLength: content.length,
        userId: userId.substring(0, 8) + '...' // Log partial ID for debugging
      });
      
      const encoder = new TextEncoder();
      const data = encoder.encode(content);
      
      // Generate random IV
      const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
      
      // Generate random salt
      const salt = crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
      
      // Derive encryption key
      const key = await this.deriveKeyWithSalt(userId, salt, masterPassword);
      
      // Encrypt the content
      const encryptedBuffer = await crypto.subtle.encrypt(
        {
          name: this.ALGORITHM,
          iv: iv
        },
        key,
        data
      );
      
      // Convert to base64 for storage
      const encryptedContent = this.arrayBufferToBase64(encryptedBuffer);
      const ivBase64 = this.arrayBufferToBase64(iv);
      const saltBase64 = this.arrayBufferToBase64(salt);
      
      console.log('✅ Content encrypted successfully', {
        originalSize: content.length,
        encryptedSize: encryptedContent.length
      });
      
      return {
        encryptedContent,
        iv: ivBase64,
        salt: saltBase64,
        version: this.VERSION
      };
    } catch (error) {
      console.error('❌ Encryption failed:', error);
      throw new Error('Failed to encrypt content');
    }
  }

  /**
   * Decrypt script content
   */
  static async decryptContent(
    encryptedData: EncryptedData, 
    userId: string, 
    masterPassword?: string
  ): Promise<string> {
    try {
      console.log('🔓 Decrypting script content...', {
        version: encryptedData.version || 'legacy',
        userId: userId.substring(0, 8) + '...'
      });
      
      // Convert from base64
      const encryptedBuffer = this.base64ToArrayBuffer(encryptedData.encryptedContent);
      const iv = this.base64ToArrayBuffer(encryptedData.iv);
      const salt = this.base64ToArrayBuffer(encryptedData.salt);
      
      // Derive the same key used for encryption
      const key = await this.deriveKeyWithSalt(userId, new Uint8Array(salt), masterPassword);
      
      // Decrypt the content
      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: this.ALGORITHM,
          iv: iv
        },
        key,
        encryptedBuffer
      );
      
      // Convert back to string
      const decoder = new TextDecoder();
      const decryptedContent = decoder.decode(decryptedBuffer);
      
      console.log('✅ Content decrypted successfully', {
        decryptedSize: decryptedContent.length
      });
      
      return decryptedContent;
    } catch (error) {
      console.error('❌ Decryption failed:', error);
      throw new Error('Failed to decrypt content - invalid key or corrupted data');
    }
  }

  /**
   * Derive key with provided salt
   */
  private static async deriveKeyWithSalt(
    userId: string, 
    salt: Uint8Array, 
    masterPassword?: string
  ): Promise<CryptoKey> {
    const keyMaterial = masterPassword ? `${userId}-${masterPassword}` : userId;
    
    const encoder = new TextEncoder();
    const keyData = encoder.encode(keyMaterial);
    
    const importedKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: this.ITERATIONS,
        hash: 'SHA-256'
      },
      importedKey,
      {
        name: this.ALGORITHM,
        length: this.KEY_LENGTH
      },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 string to ArrayBuffer
   */
  private static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Check if content is encrypted (has the encrypted data structure)
   */
  static isEncrypted(content: any): content is EncryptedData {
    return (
      typeof content === 'object' &&
      content !== null &&
      typeof content.encryptedContent === 'string' &&
      typeof content.iv === 'string' &&
      typeof content.salt === 'string'
    );
  }

  /**
   * Encrypt multiple content fields
   */
  static async encryptMultipleFields(
    fields: Record<string, string>,
    userId: string,
    masterPassword?: string
  ): Promise<Record<string, EncryptedData>> {
    const encrypted: Record<string, EncryptedData> = {};
    
    for (const [key, value] of Object.entries(fields)) {
      if (value && typeof value === 'string') {
        encrypted[key] = await this.encryptContent(value, userId, masterPassword);
      }
    }
    
    return encrypted;
  }

  /**
   * Decrypt multiple content fields
   */
  static async decryptMultipleFields(
    encryptedFields: Record<string, EncryptedData>,
    userId: string,
    masterPassword?: string
  ): Promise<Record<string, string>> {
    const decrypted: Record<string, string> = {};
    
    for (const [key, encryptedData] of Object.entries(encryptedFields)) {
      if (this.isEncrypted(encryptedData)) {
        decrypted[key] = await this.decryptContent(encryptedData, userId, masterPassword);
      }
    }
    
    return decrypted;
  }

  /**
   * Migrate existing plain text content to encrypted format
   */
  static async migrateToEncrypted(
    plainTextContent: string,
    userId: string
  ): Promise<EncryptedData> {
    console.log('🔄 Migrating plain text content to encrypted format...');
    return await this.encryptContent(plainTextContent, userId);
  }
}