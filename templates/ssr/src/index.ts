import { hydrate } from 'ripple';
// @ts-expect-error: known issue, we're working on it
import { App } from './App.ripple';

const target = document.getElementById('root');

if (!target) {
	throw new Error('Missing #root mount target');
}

hydrate(App, { target });
