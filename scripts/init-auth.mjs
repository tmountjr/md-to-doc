#!/usr/bin/env node
import { getAuthClient } from './auth.mjs';

await getAuthClient();
console.log('Authentication successful. Token cached for future use.');
