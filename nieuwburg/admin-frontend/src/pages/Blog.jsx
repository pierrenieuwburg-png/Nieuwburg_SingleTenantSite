import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom'; // We'll use this for "Edit" later
import { BarLoader } from 'react-spinners'; // Use the same loader

// Helper to format dates
const formatDate = (isoString) => {
  if (!isoString) return 'No date';
  try {
    return new Date(isoString).toLocaleDateString('en-ZA', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch (error) {
    console.warn("Could not format date:", isoString, error);
    return "Invalid date";
  }
};

function Blog() {
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPosts = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/admin/blog/posts'); // Your API endpoint
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setPosts(data);
        setError(null);
      } catch (err) {
        console.error("Error fetching blog posts:", err);
        setError(`Error loading posts: ${err.message}`);
        setPosts([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPosts();
  }, []); // Runs once on mount

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center h-64">
          <BarLoader color="#4A90E2" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center text-red-500 p-4">
          {error}
        </div>
      );
    }

    if (posts.length === 0) {
      return (
        <div className="text-center text-gray-500 p-4">
          No blog posts have been created yet.
        </div>
      );
    }

    // Render the list of posts
    return (
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 data-table">
           <thead className="bg-gray-50">
             <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Author</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {posts.map((post) => (
              <tr key={post.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{post.title}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-700">{post.author_name || 'N/A'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-700">{formatDate(post.date_posted)}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {/* We will build this Edit page later */}
                   {/* <Link to={`/admin/blog/edit/${post.id}`} className="cta-outline-small">
                    Edit
                  </Link> */}
                  <a href={`/blog/post/${post.id}`} target="_blank" rel="noopener noreferrer" className="cta-outline-small ml-2">
                    View
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Blog Management</h1>
        {/* We will wire this up later to a "create" page */}
        {/* <Link to="/admin/blog/new" className="btn btn-primary">
          Add New Post
        </Link> */}
      </div>

      {renderContent()}

    </div>
  );
}

export default Blog;