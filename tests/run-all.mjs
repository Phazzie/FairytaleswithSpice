#!/usr/bin/env node
/**
 * TEST RUNNER - Executes all test suites
 * 
 * Run: npm test
 * Or: node tests/run-all.mjs
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runTest(testFile, testName) {
  return new Promise((resolve) => {
    log(`\n${'='.repeat(80)}`, 'cyan');
    log(`Running: ${testName}`, 'bold');
    log('='.repeat(80), 'cyan');
    
    const testPath = join(__dirname, testFile);
    const child = spawn('node', [testPath], {
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: '1' }
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        log(`\n✅ ${testName} PASSED`, 'green');
      } else {
        log(`\n❌ ${testName} FAILED (exit code: ${code})`, 'red');
      }
      resolve(code === 0);
    });
    
    child.on('error', (error) => {
      log(`\n💥 ${testName} ERROR: ${error.message}`, 'red');
      resolve(false);
    });
  });
}

async function runAllTests() {
  log('\n' + '█'.repeat(80), 'cyan');
  log('🧪 FAIRYTALES WITH SPICE - COMPREHENSIVE TEST SUITE', 'bold');
  log('█'.repeat(80) + '\n', 'cyan');
  
  const testSuites = [
    { file: 'story-service.test.mjs', name: 'Story Generation Service Tests' },
    { file: 'audio-service.test.mjs', name: 'Audio Conversion Service Tests' }
  ];
  
  const results = [];
  
  for (const suite of testSuites) {
    const passed = await runTest(suite.file, suite.name);
    results.push({ name: suite.name, passed });
    
    // Small delay between suites
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Final summary
  log('\n' + '█'.repeat(80), 'cyan');
  log('📊 FINAL TEST SUMMARY', 'bold');
  log('█'.repeat(80), 'cyan');
  
  console.log('');
  results.forEach(result => {
    const status = result.passed ? '✅ PASSED' : '❌ FAILED';
    const color = result.passed ? 'green' : 'red';
    log(`${status} - ${result.name}`, color);
  });
  
  const allPassed = results.every(r => r.passed);
  const passedCount = results.filter(r => r.passed).length;
  
  console.log('');
  log(`Results: ${passedCount}/${results.length} test suites passed`, 
    allPassed ? 'green' : 'yellow');
  
  console.log('');
  
  if (allPassed) {
    log('🎉 ALL TEST SUITES PASSED!', 'green');
    process.exit(0);
  } else {
    log('⚠️  SOME TEST SUITES FAILED', 'yellow');
    process.exit(1);
  }
}

runAllTests().catch(error => {
  log(`\n💥 Test runner error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
