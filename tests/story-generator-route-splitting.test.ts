#!/usr/bin/env tsx

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as ts from 'typescript';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const routesPath = join(process.cwd(), 'story-generator/src/app/app.routes.ts');
const sourceText = readFileSync(routesPath, 'utf8');
const sourceFile = ts.createSourceFile(routesPath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

function getPropertyName(property: ts.ObjectLiteralElementLike): string | undefined {
  if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) {
    return undefined;
  }

  return property.name.text;
}

function getStringLiteralPropertyValue(objectLiteral: ts.ObjectLiteralExpression, propertyName: string): string | undefined {
  const property = objectLiteral.properties.find(
    (candidate) => getPropertyName(candidate) === propertyName
  );

  if (!property || !ts.isPropertyAssignment(property) || !ts.isStringLiteral(property.initializer)) {
    return undefined;
  }

  return property.initializer.text;
}

function findRouteObject(path: string): ts.ObjectLiteralExpression | undefined {
  let foundRoute: ts.ObjectLiteralExpression | undefined;

  function visit(node: ts.Node): void {
    if (foundRoute) {
      return;
    }

    if (ts.isObjectLiteralExpression(node) && getStringLiteralPropertyValue(node, 'path') === path) {
      foundRoute = node;
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return foundRoute;
}

const eagerProvingGroundsImport = sourceFile.statements.find((statement) => {
  if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
    return false;
  }

  return statement.moduleSpecifier.text.startsWith('./proving-grounds/');
});

assert(
  !eagerProvingGroundsImport,
  'Proving Grounds should not be eagerly imported by app.routes.ts because it should stay out of the initial app bundle'
);

const provingGroundsRoute = findRouteObject('proving-grounds');
assert(provingGroundsRoute, 'expected a route for /proving-grounds');

const routePropertyNames = new Set(
  provingGroundsRoute.properties.map((property) => getPropertyName(property)).filter(Boolean)
);
assert(routePropertyNames.has('loadComponent'), 'the /proving-grounds route should lazy-load its component');
assert(!routePropertyNames.has('component'), 'the /proving-grounds route should not eagerly reference its component');

const loadComponentProperty = provingGroundsRoute.properties.find(
  (property): property is ts.PropertyAssignment => getPropertyName(property) === 'loadComponent' && ts.isPropertyAssignment(property)
);
assert(loadComponentProperty, 'expected a loadComponent property for /proving-grounds');
assert(
  loadComponentProperty.initializer.getText(sourceFile).includes("import('./proving-grounds/proving-grounds')"),
  'the /proving-grounds route should dynamically import the Proving Grounds component module'
);

console.log('Story generator route splitting tests passed');
