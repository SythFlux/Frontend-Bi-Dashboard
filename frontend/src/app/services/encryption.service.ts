import { Injectable, OnInit } from '@angular/core';
import {HttpClient} from "@angular/common/http";
import * as forge from 'node-forge';
import {map, Observable} from "rxjs";
import {ApiService} from "./api.service";
import axios from "axios";

@Injectable({
  providedIn: 'root'
})
export class EncryptionService {
  private publicKey: CryptoKey | undefined;
  private privateKey: CryptoKey | undefined;

  private pubKey: string | undefined;

  private keyPair = forge.pki.rsa.generateKeyPair({ bits: 2048 });

  constructor(private httpClient: HttpClient) { }



  /**
   * Use the retrieved public key from the API to encrypt the text with sha256.
   * @param text The text to encrypt
   */
  encryptWithPublicKey(text: string): string {
    if(this.pubKey) {
      const forgePublicKey = forge.pki.publicKeyFromPem(this.pubKey);

      const encryptedData = forgePublicKey.encrypt(text, 'RSA-OAEP', {
        md: forge.md.sha256.create()
      });
      console.log('Encrypted: ', forge.util.encode64(encryptedData));
      return forge.util.encode64(encryptedData);
    }
    return "";
  }

  /**
   * Decrypt the text with the private key
   * @param encryptedText The text to decrypt
   */
  decryptWithPrivateKey(encryptedText: string): string {
    const privateKey = this.keyPair.privateKey;
    const encrypted = forge.util.decode64(encryptedText);
    const decrypted = privateKey.decrypt(encrypted);
    return decrypted;
  }
}

