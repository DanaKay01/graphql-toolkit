import { IResolvers, IFieldResolver } from '@kamilkisiela/graphql-tools';
import { chainFunctions, asArray } from './helpers';
import { flattenArray } from './flatten-array';

export type ResolversComposition<Resolver extends IFieldResolver<any, any> = IFieldResolver<any, any>> = (next: Resolver) => Resolver;

export type ResolversComposerMapping<Resolvers extends IResolvers = IResolvers> =
  | {
    [TypeName in keyof Resolvers]?: {
      [FieldName in keyof Resolvers[TypeName]]: Resolvers[TypeName][FieldName] extends IFieldResolver<any, any>
      ? ResolversComposition<Resolvers[TypeName][FieldName]> | Array<ResolversComposition<Resolvers[TypeName][FieldName]>>
      : ResolversComposition | ResolversComposition[]
    }
  }
  | {
    [path: string]: ResolversComposition | ResolversComposition[];
  };

function resolveRelevantMappings<Resolvers extends IResolvers>(resolvers: Resolvers, path: string, allMappings: ResolversComposerMapping<Resolvers>): string[] {
  const splitted = path.split('.');

  if (splitted.length === 2) {
    const typeName = splitted[0];
    const fieldName = splitted[1];

    if (fieldName === '*') {
      return flattenArray(
        Object.keys(resolvers[typeName])
          .map(field => resolveRelevantMappings(resolvers, `${typeName}.${field}`, allMappings))
      )
        .filter(mapItem => !allMappings[mapItem]);
    } else {
      const paths = [];

      if (resolvers[typeName] && resolvers[typeName][fieldName]) {
        if (resolvers[typeName][fieldName]['subscribe']) {
          paths.push(path + '.subscribe');
        }
        if (resolvers[typeName][fieldName]['resolve']) {
          paths.push(path + '.resolve');
        }
        if (typeof resolvers[typeName][fieldName] === 'function') {
          paths.push(path);
        }
      }

      return paths;
    }
  } else if (splitted.length === 1) {
    const typeName = splitted[0];
    return flattenArray(
      Object.keys(resolvers[typeName])
        .map(fieldName => resolveRelevantMappings(resolvers, `${typeName}.${fieldName}`, allMappings))
    );
  }

  return [];
}

const get = (obj: any, path: string) => {
  const subPathArr = path.split('.');
  let deep = obj;
  for(let subPath of subPathArr) {
    deep = deep[subPath];
  }
  return deep;
}

const set = (obj: any, path: string, val: any) => {
  const subPathArr = path.split('.');
  let deep = obj;
  for(let subPath of subPathArr) {
    if (subPath === subPathArr[subPathArr.length - 1]) {
      deep[subPath] = val;
    }
    deep = deep[subPath];
  }
}

/**
 * Wraps the resolvers object with the resolvers composition objects.
 * Implemented as a simple and basic middleware mechanism.
 *
 * @param resolvers - resolvers object
 * @param mapping - resolvers composition mapping
 * @hidden
 */
export function composeResolvers<Resolvers extends IResolvers>(resolvers: Resolvers, mapping: ResolversComposerMapping<Resolvers> = {}): Resolvers {
  const mappingResult: { [path: string]: Function[] } = {};

  Object.keys(mapping).map((resolverPath: string) => {
    if (mapping[resolverPath] instanceof Array || typeof mapping[resolverPath] === 'function') {
      const composeFns = mapping[resolverPath] as ResolversComposition | ResolversComposition[];
      const relevantFields = resolveRelevantMappings(resolvers, resolverPath, mapping);
      relevantFields.forEach((path: string) => {
        mappingResult[path] = asArray(composeFns);
      });
    } else {
      Object.keys(mapping[resolverPath]).map(fieldName => {
        const composeFns = mapping[resolverPath][fieldName];
        const relevantFields = resolveRelevantMappings(resolvers, resolverPath + '.' + fieldName, mapping);
        relevantFields.forEach((path: string) => {
          mappingResult[path] = asArray(composeFns);
        });
      });
    }
  });

  Object.keys(mappingResult).forEach(path => {
    const fns = chainFunctions([...asArray(mappingResult[path]), () => get(resolvers, path)]);

    set(resolvers, path, fns());
  });

  return resolvers;
}
