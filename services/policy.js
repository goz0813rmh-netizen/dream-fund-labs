import { NORTH_STAR, PRINCIPLES } from '../data/policies.js';

export function getNorthStar() {
  return NORTH_STAR;
}

export function getPrinciples() {
  return PRINCIPLES;
}

export function getPolicy(id) {
  return PRINCIPLES.find(p => p.id === id) ?? null;
}
