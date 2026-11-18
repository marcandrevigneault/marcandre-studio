import { expect, it } from 'vitest';
import { pageViews } from './page-views';
it('includes zero-view pages and merges trailing-slash variants without losing unknown pages', () => {
  const rows = pageViews([{path:'/about', views:2}, {path:'/about/', views:3}, {path:'/new/', views:1}]);
  expect(rows[0]).toEqual({path:'/about/', title:'À propos', views:5});
  expect(rows).toContainEqual({path:'/', title:'Accueil', views:0});
  expect(rows).toContainEqual({path:'/new/', title:'/new/', views:1});
  expect(rows.reduce((sum, row) => sum + row.views, 0)).toBe(6);
});
it('includes published content from the supplied catalog', () => {
  expect(pageViews([], [{path:'/photography/forest/', title:'Forêt'}])).toEqual([{path:'/photography/forest/', title:'Forêt', views:0}]);
});
